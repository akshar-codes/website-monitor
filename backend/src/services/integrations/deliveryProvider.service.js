import { createHmac } from "node:crypto";
import dns from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";
import { isPublicAddress } from "../../workers/poller.js";
import { decryptCredential } from "../../utils/credentialEncryption.js";

const SAFE_RESPONSE_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 8_000;
const cleanHost = (host) => host.replace(/^\[|\]$/g, "");

export const validatePublicHttpsUrl = async (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid HTTPS URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname
  )
    throw new Error(
      "Destinations must use HTTPS and cannot contain embedded credentials",
    );
  const hostname = cleanHost(url.hostname);
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await dns.lookup(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw new Error("Destination resolves to a restricted network address");
  return { url, addresses };
};

export const requestPublicHttps = async ({
  url: value,
  payload,
  headers = {},
}) => {
  const { url, addresses } = await validatePublicHttpsUrl(value);
  const body = payload == null ? null : Buffer.from(JSON.stringify(payload));
  if (body && body.length > 32_768)
    throw new Error("Alert payload is too large");
  const chosen = addresses[0];
  return new Promise((resolve, reject) => {
    let responseText = "";
    const req = https.request(
      {
        protocol: "https:",
        hostname: cleanHost(url.hostname),
        port: url.port || 443,
        method: "POST",
        path: `${url.pathname}${url.search}`,
        servername: isIP(cleanHost(url.hostname))
          ? undefined
          : cleanHost(url.hostname),
        agent: false,
        lookup: (_host, options, callback) => {
          if (options?.all) callback(null, [chosen]);
          else callback(null, chosen.address, chosen.family);
        },
        headers: {
          "content-type": "application/json",
          ...(body ? { "content-length": body.length } : {}),
          ...headers,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseText += chunk;
          if (Buffer.byteLength(responseText) > SAFE_RESPONSE_BYTES)
            req.destroy(new Error("Provider response exceeded limit"));
        });
        res.on("end", () => {
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) return resolve({ status });
          const error = new Error(`Provider returned HTTP ${status}`);
          error.status = status;
          const retryAfterHeader = res.headers["retry-after"];
          const retryAfterSeconds = Number(retryAfterHeader);
          const retryAfterDateMs =
            Date.parse(retryAfterHeader || "") - Date.now();
          const retryAfterMs =
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? retryAfterSeconds * 1000
              : retryAfterDateMs > 0
                ? retryAfterDateMs
                : null;
          if (retryAfterMs)
            error.retryAfterMs = Math.min(retryAfterMs, 3_600_000);
          reject(error);
        });
      },
    );
    req.on("timeout", () =>
      req.destroy(new Error("Provider request timed out")),
    );
    req.on("error", (error) => reject(error));
    if (body) req.write(body);
    req.end();
  });
};

const compact = (text, max = 1800) => String(text || "").slice(0, max);
const integrationSecrets = (integration) =>
  Object.fromEntries(
    Object.entries(integration.credentials || {}).map(([key, value]) => [
      key,
      decryptCredential(value),
    ]),
  );

export const deliverToProvider = async (integration, payload) => {
  const credentials = integrationSecrets(integration);
  const title = compact(payload.title || payload.type, 200);
  const message = compact(payload.message, 3000);
  if (integration.provider === "slack") {
    return requestPublicHttps({
      url: credentials.webhookUrl,
      payload: {
        text: `*${title}*\n${message}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: title } },
          { type: "section", text: { type: "plain_text", text: message } },
          {
            type: "context",
            elements: [
              { type: "plain_text", text: `SiteWatch · ${payload.type}` },
            ],
          },
        ],
      },
    });
  }
  if (integration.provider === "discord") {
    return requestPublicHttps({
      url: credentials.webhookUrl,
      payload: {
        username: integration.config?.username || "SiteWatch",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title,
            description: message,
            color:
              payload.priority === "critical"
                ? 0xdc2626
                : payload.priority === "high"
                  ? 0xea580c
                  : 0x2563eb,
            fields: [
              {
                name: "Event",
                value: compact(payload.type, 100),
                inline: true,
              },
              ...(payload.incidentId
                ? [
                    {
                      name: "Incident",
                      value: compact(payload.incidentId, 100),
                      inline: true,
                    },
                  ]
                : []),
            ],
            timestamp: payload.createdAt || new Date().toISOString(),
          },
        ],
      },
    });
  }
  if (integration.provider === "telegram") {
    const token = credentials.botToken;
    return requestPublicHttps({
      url: `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      payload: {
        chat_id: integration.config?.chatId,
        text: `${title}\n\n${message}`,
      },
    });
  }
  if (integration.provider === "webhook") {
    const body = JSON.stringify({
      id: payload.eventId,
      type: payload.type,
      createdAt: payload.createdAt || new Date().toISOString(),
      data: {
        title,
        message,
        monitorId: payload.monitorId || null,
        incidentId: payload.incidentId || null,
        severity: payload.severity || null,
        priority: payload.priority || "normal",
        link: payload.link || null,
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", credentials.signingSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    let customHeaders = {};
    if (credentials.customHeaders) {
      try {
        customHeaders = JSON.parse(credentials.customHeaders);
      } catch {
        throw new Error("Stored custom webhook headers are invalid");
      }
    }
    return requestPublicHttps({
      url: integration.config.endpointUrl,
      payload: JSON.parse(body),
      headers: {
        ...customHeaders,
        "x-sitewatch-event": payload.type,
        "x-sitewatch-delivery": payload.eventId,
        "x-sitewatch-timestamp": timestamp,
        "x-sitewatch-signature": `sha256=${signature}`,
      },
    });
  }
  throw new Error("Unsupported notification provider");
};
