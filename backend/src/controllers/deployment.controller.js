import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";
import * as deploymentService from "../services/deployment.service.js";

export const createIntegration = asyncHandler(async (req, res) => {
  const result = await deploymentService.createDeploymentIntegration(
    req.user,
    req.body,
  );
  sendSuccess(res, {
    statusCode: 201,
    message:
      "Deployment integration created. Copy the secret now; it will not be shown again.",
    data: result,
  });
});

export const listIntegrations = asyncHandler(async (req, res) => {
  const integrations = await deploymentService.listDeploymentIntegrations(
    req.user,
  );
  sendSuccess(res, { data: integrations });
});

export const rotateIntegrationSecret = asyncHandler(async (req, res) => {
  const result = await deploymentService.rotateDeploymentSecret(
    req.user,
    req.params.id,
    req.body || {},
  );
  sendSuccess(res, {
    message: result.message,
    data: result,
  });
});

export const revokeIntegration = asyncHandler(async (req, res) => {
  const integration = await deploymentService.revokeDeploymentIntegration(
    req.user,
    req.params.id,
  );
  sendSuccess(res, {
    message: "Deployment integration revoked",
    data: integration,
  });
});

export const deleteIntegration = asyncHandler(async (req, res) => {
  await deploymentService.deleteDeploymentIntegration(req.user, req.params.id);
  sendSuccess(res, { message: "Deployment integration deleted" });
});

export const ingestDeploymentEvent = asyncHandler(async (req, res) => {
  const headerIdempotencyKey =
    req.get("idempotency-key") || req.get("x-idempotency-key");
  const payload = {
    ...req.body,
    ...(headerIdempotencyKey && !req.body.idempotencyKey
      ? { idempotencyKey: headerIdempotencyKey }
      : {}),
  };

  const result = await deploymentService.recordDeploymentEvent({
    integration: req.deploymentIntegration,
    payload,
  });

  if (result.isDuplicate) {
    return sendSuccess(res, {
      statusCode: 200,
      message: "Deployment event already recorded",
      data: result.event,
      meta: { duplicate: true },
    });
  }

  return sendSuccess(res, {
    statusCode: 201,
    message: "Deployment event recorded successfully",
    data: result.event,
    meta: { duplicate: false },
  });
});

export const listDeploymentEvents = asyncHandler(async (req, res) => {
  const result = await deploymentService.listDeploymentEvents(
    req.user,
    req.validatedQuery || req.query,
  );
  return sendPaginated(res, result);
});

export const getDeploymentEvent = asyncHandler(async (req, res) => {
  const event = await deploymentService.getDeploymentEvent(
    req.user,
    req.params.id,
  );
  return sendSuccess(res, { data: event });
});

/**
 * GET /api/monitors/:id/deployments
 */
export const getMonitorDeployments = asyncHandler(async (req, res) => {
  const result = await deploymentService.getDeploymentsForMonitor(
    req.params.id,
    req.user,
    req.validatedQuery || req.query,
  );
  return sendPaginated(res, {
    data: result.deployments,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

/**
 * GET /api/monitors/:id/deployments/:deploymentId
 */
export const getMonitorDeploymentById = asyncHandler(async (req, res) => {
  const deployment = await deploymentService.getDeploymentByIdForMonitor(
    req.params.id,
    req.params.deploymentId,
    req.user,
  );
  return sendSuccess(res, { data: deployment });
});

/**
 * GET /api/monitors/:id/deployments/:deploymentId/impact
 */
export const getDeploymentImpact = asyncHandler(async (req, res) => {
  const impact = await deploymentService.getDeploymentImpact(
    req.params.id,
    req.params.deploymentId,
    req.user,
    req.validatedQuery || req.query,
  );
  return sendSuccess(res, { data: impact });
});
