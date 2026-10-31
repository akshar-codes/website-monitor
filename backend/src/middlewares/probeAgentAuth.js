import { timingSafeEqual } from "node:crypto";
import env from "../config/env.js";
import { getRegion } from "../config/regions.js";
import ApiError from "../utils/ApiError.js";
import { signProbeRequest } from "../utils/probeSignature.js";
import ProbeRequestNonce from "../models/ProbeRequestNonce.js";

export const getProbeAgentCredentials = () => {
  try {
    const value = JSON.parse(env.PROBE_AGENT_CONFIG || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};

const probeAgentAuth = async (req, _res, next) => {
  const agentId = req.get("x-probe-agent");
  const timestamp = req.get("x-probe-timestamp");
  const signature = req.get("x-probe-signature");
  const nonce = req.get("x-probe-nonce");
  const credential = getProbeAgentCredentials()[agentId];
  const timestampNumber = Number(timestamp);
  if (
    typeof credential?.secret !== "string" ||
    Buffer.byteLength(credential.secret) < 32 ||
    !getRegion(credential.regionId) ||
    !Number.isFinite(timestampNumber) ||
    Math.abs(Date.now() - timestampNumber) > 5 * 60_000 ||
    typeof signature !== "string" ||
    typeof nonce !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(nonce) ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return next(ApiError.unauthorized("Probe agent authentication failed"));

  const bodyText = JSON.stringify(req.body || {});
  const expected = signProbeRequest({
    secret: credential.secret,
    timestamp,
    nonce,
    method: req.method,
    path: req.originalUrl,
    bodyText,
  });
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return next(ApiError.unauthorized("Probe agent signature is invalid"));
  }
  try {
    await ProbeRequestNonce.create({
      agentId,
      nonce,
      expiresAt: new Date(timestampNumber + 6 * 60_000),
    });
  } catch (error) {
    if (error.code === 11000)
      return next(ApiError.unauthorized("Probe request was already used"));
    return next(error);
  }
  req.probeAgent = { agentId, regionId: credential.regionId };
  return next();
};

export default probeAgentAuth;
