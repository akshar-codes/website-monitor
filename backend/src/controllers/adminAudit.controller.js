import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { sendPaginated, sendSuccess } from "../utils/apiResponse.js";
import * as adminAuditService from "../services/adminAudit.service.js";

export const listAdminAuditEvents = asyncHandler(async (req, res) => {
  const result = await adminAuditService.listAdminAuditEvents(
    req.validatedQuery,
  );
  sendPaginated(res, {
    data: result.events,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const getAdminAuditEvent = asyncHandler(async (req, res) => {
  const event = await adminAuditService.getAdminAuditEvent(req.params.id);
  if (!event) throw ApiError.notFound("Audit event not found");
  sendSuccess(res, { data: event });
});
