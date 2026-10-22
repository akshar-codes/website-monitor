import asyncHandler from "../utils/asyncHandler.js";
import * as monitorService from "../services/monitor.service.js";
import { sendPaginated, sendSuccess } from "../utils/apiResponse.js";

const publicMonitorFields = (monitor) => ({
  id: monitor.id || monitor._id?.toString(),
  name: monitor.name,
  url: monitor.url,
  interval: monitor.interval,
  active: monitor.active,
  lastCheckedAt: monitor.lastCheckedAt,
  nextCheckAt: monitor.nextCheckAt,
  createdAt: monitor.createdAt,
  updatedAt: monitor.updatedAt,
});

export const listMonitors = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await monitorService.getMonitors(query, req.user);
  sendPaginated(res, {
    data: result.monitors.map(publicMonitorFields),
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

export const getMonitor = asyncHandler(async (req, res) => {
  const monitor = await monitorService.getMonitorById(req.params.id, req.user);
  sendSuccess(res, { data: publicMonitorFields(monitor) });
});
