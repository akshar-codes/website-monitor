import asyncHandler from "../utils/asyncHandler.js";
import { sendPaginated, sendSuccess } from "../utils/apiResponse.js";
import * as integrations from "../services/integrations/integration.service.js";
import * as alerting from "../services/alerting/alerting.service.js";

export const listIntegrations = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await integrations.listIntegrations(req.user) }),
);
export const createIntegration = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    statusCode: 201,
    data: await integrations.createIntegration(req.body, req.user),
  }),
);
export const getIntegration = asyncHandler(async (req, res) => {
  const row = (await integrations.listIntegrations(req.user)).find(
    (item) => String(item._id) === req.params.id,
  );
  if (!row)
    return res
      .status(404)
      .json({ success: false, message: "Integration not found" });
  return sendSuccess(res, { data: row });
});
export const updateIntegration = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await integrations.updateIntegration(
      req.params.id,
      req.body,
      req.user,
    ),
  }),
);
export const deleteIntegration = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await integrations.deleteIntegration(req.params.id, req.user),
  }),
);
export const enableIntegration = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await integrations.setIntegrationActive(
      req.params.id,
      true,
      req.user,
    ),
  }),
);
export const disableIntegration = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await integrations.setIntegrationActive(
      req.params.id,
      false,
      req.user,
    ),
  }),
);
export const testIntegration = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await integrations.testIntegration(req.params.id, req.user),
  }),
);
export const listDeliveries = asyncHandler(async (req, res) => {
  const result = await alerting.listDeliveries(req.user, req.validatedQuery);
  sendPaginated(res, {
    data: result.deliveries,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});
export const retryDelivery = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.retryDelivery(req.params.id, req.user),
  }),
);

export const listRules = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await alerting.listNotificationRules(req.user) }),
);
export const createRule = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    statusCode: 201,
    data: await alerting.createNotificationRule(req.body, req.user),
  }),
);
export const updateRule = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.updateNotificationRule(
      req.params.id,
      req.body,
      req.user,
    ),
  }),
);
export const deleteRule = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.deleteNotificationRule(req.params.id, req.user),
  }),
);
export const listPolicies = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await alerting.listAlertPolicies(req.user) }),
);
export const createPolicy = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    statusCode: 201,
    data: await alerting.createAlertPolicy(req.body, req.user),
  }),
);
export const updatePolicy = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.updateAlertPolicy(req.params.id, req.body, req.user),
  }),
);
export const deletePolicy = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.deleteAlertPolicy(req.params.id, req.user),
  }),
);
export const testPolicy = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.validateAlertPolicy(req.body, req.user),
  }),
);
export const acknowledgeIncident = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.acknowledgeIncident(req.params.id, req.user),
  }),
);
export const removeIncidentAcknowledgement = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.removeIncidentAcknowledgement(req.params.id, req.user),
  }),
);
export const incidentEscalations = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await alerting.getIncidentEscalations(req.params.id, req.user),
  }),
);
