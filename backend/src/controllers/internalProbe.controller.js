import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  acceptRegionalProbeResult,
  claimRegionalProbe,
  recordAgentHeartbeat,
} from "../services/regionalProbe.service.js";

export const heartbeat = asyncHandler(async (req, res) => {
  const agent = await recordAgentHeartbeat(req.probeAgent, req.body.version);
  sendSuccess(res, {
    data: {
      agentId: agent.agentId,
      regionId: agent.regionId,
      lastHeartbeatAt: agent.lastHeartbeatAt,
    },
  });
});

export const claim = asyncHandler(async (req, res) => {
  const job = await claimRegionalProbe(req.probeAgent);
  sendSuccess(res, { data: job });
});

export const submitResult = asyncHandler(async (req, res) => {
  const result = await acceptRegionalProbeResult(
    req.params.id,
    req.probeAgent,
    req.body,
  );
  if (!result.accepted) {
    return res
      .status(result.reason === "stale_lease" ? 409 : 403)
      .json({ success: false, message: result.reason });
  }
  return sendSuccess(res, { data: result });
});
