import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { signProbeRequest } from "../utils/probeSignature.js";
import { poll } from "./poller.js";
import { classify } from "./classifier.js";

const apiBase = (process.env.PROBE_API_URL || "").replace(/\/$/, "");
const agentId = process.env.PROBE_AGENT_ID;
const regionId = process.env.PROBE_REGION_ID;
const secret = process.env.PROBE_AGENT_SECRET;
const version = process.env.PROBE_AGENT_VERSION || "1.0.0";
const pollTimeoutMs = Number(
  process.env.PROBE_AGENT_REQUEST_TIMEOUT_MS || 15_000,
);

if (!apiBase || !agentId || !regionId || !secret) {
  throw new Error(
    "PROBE_API_URL, PROBE_AGENT_ID, PROBE_REGION_ID, and PROBE_AGENT_SECRET are required",
  );
}

const request = async (path, payload) => {
  const bodyText = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const signature = signProbeRequest({
    secret,
    timestamp,
    nonce,
    method: "POST",
    path: `/api/internal/probes${path}`,
    bodyText,
  });
  const response = await fetch(`${apiBase}/api/internal/probes${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-probe-agent": agentId,
      "x-probe-timestamp": timestamp,
      "x-probe-nonce": nonce,
      "x-probe-signature": signature,
    },
    body: bodyText,
    signal: AbortSignal.timeout(pollTimeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || `Probe API responded ${response.status}`);
  return data.data;
};

const execute = async (job) => {
  let result;
  try {
    const pollResult = await poll(job.url);
    const classified = classify(pollResult);
    result = {
      leaseToken: job.leaseToken,
      healthStatus: classified.status,
      frontendStatus: classified.frontendStatus,
      backendStatus: classified.backendStatus,
      databaseStatus: classified.databaseStatus,
      responseTime: Number.isFinite(pollResult.responseTime)
        ? pollResult.responseTime
        : 0,
      httpStatus: pollResult.httpStatus ?? null,
      failureReason: classified.failureReason || null,
      timings: pollResult.timings ||
        pollResult.diagnostics?.timing || {
          dnsMs: null,
          tcpConnectMs: null,
          tlsHandshakeMs: null,
          ttfbMs: null,
          downloadMs: null,
          totalMs: null,
        },
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    result = {
      leaseToken: job.leaseToken,
      healthStatus: "down",
      frontendStatus: "unknown",
      backendStatus: "unknown",
      databaseStatus: "unknown",
      responseTime: 0,
      httpStatus: null,
      failureReason: error.code || "probe_execution_error",
      timings: {
        dnsMs: null,
        tcpConnectMs: null,
        tlsHandshakeMs: null,
        ttfbMs: null,
        downloadMs: null,
        totalMs: null,
      },
      checkedAt: new Date().toISOString(),
    };
  }
  await request(`/${job.id}/result`, result);
};

const run = async () => {
  console.info(`Probe agent ${agentId} (${regionId}) starting`);
  while (!globalThis.probeAgentStopping) {
    try {
      await request("/heartbeat", { version });
      const job = await request("/claim", {});
      if (job) await execute(job);
      else await delay(1_000);
    } catch (error) {
      console.error(`Probe agent loop error: ${error.message}`);
      await delay(2_000);
    }
  }
};

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    globalThis.probeAgentStopping = true;
  });
}

run().catch((error) => {
  console.error(`Probe agent stopped: ${error.message}`);
  process.exitCode = 1;
});
