import asyncHandler from "../utils/asyncHandler.js";
import * as jobMonitorService from "../services/jobMonitor.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

/**
 * POST /api/job-monitors
 * Create a new Job Monitor with initial reporting token.
 */
export const createJobMonitor = asyncHandler(async (req, res) => {
  const result = await jobMonitorService.createJobMonitor(req.body, req.user);

  sendSuccess(res, {
    statusCode: 201,
    message: "Job monitor created successfully",
    data: result,
  });
});

/**
 * GET /api/job-monitors
 * List Job Monitors (paginated, scoped to current user).
 */
export const getJobMonitors = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await jobMonitorService.getJobMonitors(query, req.user);

  sendPaginated(res, {
    data: result.jobMonitors,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

/**
 * GET /api/job-monitors/:id
 * Retrieve a single Job Monitor by ID.
 */
export const getJobMonitorById = asyncHandler(async (req, res) => {
  const jobMonitor = await jobMonitorService.getJobMonitorById(
    req.params.id,
    req.user,
  );

  sendSuccess(res, { data: jobMonitor });
});

/**
 * PATCH /api/job-monitors/:id
 * Update an existing Job Monitor.
 */
export const updateJobMonitor = asyncHandler(async (req, res) => {
  const jobMonitor = await jobMonitorService.updateJobMonitor(
    req.params.id,
    req.body,
    req.user,
  );

  sendSuccess(res, {
    message: "Job monitor updated successfully",
    data: jobMonitor,
  });
});

/**
 * DELETE /api/job-monitors/:id
 * Delete a Job Monitor and its history.
 */
export const deleteJobMonitor = asyncHandler(async (req, res) => {
  const result = await jobMonitorService.deleteJobMonitor(
    req.params.id,
    req.user,
  );

  sendSuccess(res, { message: result.message });
});

/**
 * POST /api/job-monitors/:id/rotate-token
 * Explicitly rotate the reporting token for a Job Monitor.
 */
export const rotateJobMonitorToken = asyncHandler(async (req, res) => {
  const result = await jobMonitorService.rotateJobMonitorToken(
    req.params.id,
    req.user,
  );

  sendSuccess(res, {
    message: result.message,
    data: result,
  });
});

/**
 * PATCH /api/job-monitors/:id/pause
 * Pause or resume a Job Monitor.
 */
export const toggleJobMonitorPause = asyncHandler(async (req, res) => {
  const pause = req.body?.pause !== undefined ? Boolean(req.body.pause) : true;
  const jobMonitor = await jobMonitorService.toggleJobMonitorPause(
    req.params.id,
    pause,
    req.user,
  );

  sendSuccess(res, {
    message: pause
      ? "Job monitor paused successfully"
      : "Job monitor resumed successfully",
    data: jobMonitor,
  });
});

/**
 * GET /api/job-monitors/:id/runs
 * Retrieve execution run history for a Job Monitor.
 */
export const getJobRuns = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await jobMonitorService.getJobRuns(
    req.params.id,
    query,
    req.user,
  );

  sendPaginated(res, {
    data: result.runs,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});
