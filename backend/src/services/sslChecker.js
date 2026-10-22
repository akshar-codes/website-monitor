/**
 * SSL / domain checker
 * Performs a raw TLS handshake to read the certificate a monitor's
 * endpoint presents, and a best-effort RDAP domain lookup for its
 * registration data. Pure I/O + classification — no persistence here;
 * see services/ssl.service.js#runAndPersistCheck for how a result is
 * turned into a saved SslInfo document.
 */

import tls from "tls";
import { URL } from "url";
import env from "../config/env.js";
import {
  SSL_STATUS,
  DOMAIN_STATUS,
  SSL_EXPIRY_THRESHOLDS,
  DOMAIN_EXPIRY_THRESHOLDS,
} from "../constants/sslConstants.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Extracts the hostname WebMonitor should open a TLS connection to and
 * perform a domain lookup for, given a monitor's stored URL. Returns
 * `null` for an unparseable URL rather than throwing.
 */
export const extractHostname = (monitorUrl) => {
  try {
    return new URL(monitorUrl).hostname;
  } catch {
    return null;
  }
};

/**
 * True when a monitor's URL is eligible for SSL/domain monitoring — a
 * TLS certificate only exists for HTTPS endpoints.
 */
export const isSslEligible = (monitorUrl) => {
  try {
    return new URL(monitorUrl).protocol === "https:";
  } catch {
    return false;
  }
};

const daysBetween = (from, to) =>
  Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);

/**
 * Opens a raw TLS socket to `hostname:port` and reads the peer
 * certificate presented during the handshake. `rejectUnauthorized` is
 * deliberately false — WebMonitor needs to inspect and report on
 * invalid/expired/self-signed certificates rather than have the
 * connection itself fail closed, since detecting exactly that condition
 * is the point of this feature.
 */
const fetchPeerCertificate = (hostname, port, timeoutMs) =>
  new Promise((resolve, reject) => {
    let settled = false;

    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      () => {
        if (settled) return;
        settled = true;

        const cert = socket.getPeerCertificate(true);
        const protocol = socket.getProtocol();
        const authorized = socket.authorized;
        const authorizationError = socket.authorizationError || null;

        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error("Server did not present a certificate"));
          return;
        }

        resolve({ cert, protocol, authorized, authorizationError });
      },
    );

    socket.on("timeout", () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error("TLS handshake timed out"));
    });

    socket.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });

/**
 * Normalises Node's raw peer-certificate object into the shape persisted
 * on SslInfo.certificate.
 */
const parseCertificate = ({
  cert,
  protocol,
  authorized,
  authorizationError,
}) => {
  const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
  const validTo = cert.valid_to ? new Date(cert.valid_to) : null;

  const subjectAlternativeNames = cert.subjectaltname
    ? cert.subjectaltname
        .split(",")
        .map((entry) => entry.trim().replace(/^DNS:/i, ""))
        .filter(Boolean)
    : [];

  const issuerOrganization = cert.issuer?.O || null;
  const selfSigned =
    !!cert.issuer &&
    !!cert.subject &&
    cert.issuer.CN === cert.subject.CN &&
    cert.issuer.O === cert.subject.O;

  return {
    valid: !!authorized,
    selfSigned,
    validFrom,
    validTo,
    issuer: cert.issuer?.CN || issuerOrganization || null,
    issuerOrganization,
    subject: cert.subject?.CN || null,
    subjectAlternativeNames,
    serialNumber: cert.serialNumber || null,
    fingerprint: cert.fingerprint || null,
    fingerprint256: cert.fingerprint256 || null,
    signatureAlgorithm: cert.signatureAlgorithm || null,
    protocol: protocol || null,
    keyBits: typeof cert.bits === "number" ? cert.bits : null,
    authorizationError,
  };
};

/**
 * Checks the TLS certificate served at `hostname:443` (or `port`). Never
 * throws — network/handshake failures are captured in the returned shape
 * (`ok: false`) so the caller can persist "unreachable" as a status
 * rather than treating a connectivity blip as an application crash.
 */
export const checkCertificate = async (hostname, port = 443, timeoutMs) => {
  const timeout = timeoutMs ?? env.SSL_CHECK_TIMEOUT_MS;

  try {
    const result = await fetchPeerCertificate(hostname, port, timeout);
    return { ok: true, ...parseCertificate(result) };
  } catch (error) {
    return { ok: false, error: error.message || "Unknown TLS error" };
  }
};

/**
 * Looks up domain registration data via RDAP — the structured, machine-
 * readable successor to WHOIS. rdap.org acts as a public bootstrap
 * redirector to the authoritative registry for any TLD, so no per-TLD
 * server configuration is needed. Best-effort: many registries restrict
 * or omit registrant/registrar data and not every TLD runs an RDAP
 * server, so a lookup failure degrades to "unknown" domain info rather
 * than failing the certificate check it's paired with.
 */
export const checkDomain = async (hostname, timeoutMs) => {
  const timeout = timeoutMs ?? env.DOMAIN_LOOKUP_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`https://rdap.org/domain/${hostname}`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/rdap+json" },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        ok: false,
        error: `RDAP lookup returned HTTP ${response.status}`,
      };
    }

    const body = await response.json();

    const events = Array.isArray(body.events) ? body.events : [];
    const findEvent = (action) =>
      events.find((e) => e.eventAction === action)?.eventDate || null;

    const registeredAt = findEvent("registration");
    const updatedAtRaw =
      findEvent("last changed") || findEvent("last update of RDAP database");
    const expiresAtRaw = findEvent("expiration");

    const registrarEntity = (body.entities || []).find((e) =>
      (e.roles || []).includes("registrar"),
    );
    const registrar =
      registrarEntity?.vcardArray?.[1]?.find(
        (field) => field[0] === "fn",
      )?.[3] ||
      registrarEntity?.handle ||
      null;

    const nameServers = (body.nameservers || [])
      .map((ns) => ns.ldhName)
      .filter(Boolean);

    const statuses = Array.isArray(body.status) ? body.status : [];

    return {
      ok: true,
      name: (body.ldhName || hostname).toLowerCase(),
      registrar,
      registeredAt: registeredAt ? new Date(registeredAt) : null,
      updatedAt: updatedAtRaw ? new Date(updatedAtRaw) : null,
      expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
      nameServers,
      statuses,
    };
  } catch (error) {
    clearTimeout(timer);
    const message =
      error.name === "AbortError" ? "Domain lookup timed out" : error.message;
    return { ok: false, error: message || "Unknown domain lookup error" };
  }
};

/**
 * Derives the SSL status enum + days-remaining from a certificate check
 * result. Pure function — no I/O — so it's independently testable from
 * the network calls above.
 */
export const classifyCertificateStatus = (certResult, now = new Date()) => {
  if (!certResult.ok) {
    return { status: SSL_STATUS.UNREACHABLE, daysRemaining: null };
  }

  if (!certResult.validTo) {
    return { status: SSL_STATUS.INVALID, daysRemaining: null };
  }

  const daysRemaining = daysBetween(now, certResult.validTo);

  if (now > certResult.validTo) {
    return { status: SSL_STATUS.EXPIRED, daysRemaining };
  }

  if (!certResult.valid && !certResult.selfSigned) {
    // Chain didn't validate for a reason other than self-signing (e.g. a
    // hostname mismatch or an untrusted CA) — surface as invalid rather
    // than silently reporting a healthy expiry countdown.
    return { status: SSL_STATUS.INVALID, daysRemaining };
  }

  if (daysRemaining <= SSL_EXPIRY_THRESHOLDS.WARNING_DAYS) {
    return { status: SSL_STATUS.EXPIRING_SOON, daysRemaining };
  }

  return { status: SSL_STATUS.VALID, daysRemaining };
};

/**
 * Derives the domain status enum + days-remaining from a domain lookup
 * result.
 */
export const classifyDomainStatus = (domainResult, now = new Date()) => {
  if (!domainResult.ok || !domainResult.expiresAt) {
    return { status: DOMAIN_STATUS.UNKNOWN, daysRemaining: null };
  }

  const daysRemaining = daysBetween(now, domainResult.expiresAt);

  if (now > domainResult.expiresAt) {
    return { status: DOMAIN_STATUS.EXPIRED, daysRemaining };
  }

  if (daysRemaining <= DOMAIN_EXPIRY_THRESHOLDS.WARNING_DAYS) {
    return { status: DOMAIN_STATUS.EXPIRING_SOON, daysRemaining };
  }

  return { status: DOMAIN_STATUS.ACTIVE, daysRemaining };
};

/**
 * Runs both checks for a single hostname in parallel and returns the
 * fully-classified result the caller persists onto SslInfo. Domain
 * lookup failures never take down the certificate check (and vice
 * versa) — the two are independent data sources with independent
 * failure modes.
 */
export const performSslCheck = async (hostname) => {
  const [certResult, domainResult] = await Promise.all([
    checkCertificate(hostname),
    checkDomain(hostname),
  ]);

  const cert = classifyCertificateStatus(certResult);
  const domain = classifyDomainStatus(domainResult);

  return { certResult, domainResult, cert, domain };
};

export default {
  extractHostname,
  isSslEligible,
  checkCertificate,
  checkDomain,
  classifyCertificateStatus,
  classifyDomainStatus,
  performSslCheck,
};
