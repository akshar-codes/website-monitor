import asyncHandler from "../utils/asyncHandler.js";
import { getAdminDashboard as getAdminDashboardData } from "../services/adminDashboard.service.js";
import * as adminOperationsService from "../services/adminOperations.service.js";
import * as adminService from "../services/admin.service.js";
import * as planUpgradeRequestService from "../services/planUpgradeRequest.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers: users ───────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Supports pagination plus optional search/role/plan/status filters (see
 * validators/admin.validator.js#listUsersSchema).
 */
export const getUsers = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await adminService.getUsers(query);

  sendPaginated(res, {
    data: result.users,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

export const getUserDetails = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await adminService.getUserDetails(req.params.id) });
});

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.validatedQuery;
  const data = await getAdminDashboardData({
    startDate:
      startDate || new Date((endDate || new Date()).getTime() - 30 * 86400000),
    endDate: endDate || new Date(),
  });
  sendSuccess(res, { data });
});

export const getAdminMonitors = asyncHandler(async (req, res) => {
  const result = await adminOperationsService.listAdminMonitors(
    req.validatedQuery,
  );
  sendPaginated(res, {
    data: result.monitors,
    page: result.page,
    limit: req.validatedQuery.limit,
    total: result.total,
  });
});
export const getAdminMonitorDetails = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await adminOperationsService.getAdminMonitorDetail(
      req.params.id,
      req.validatedQuery.window,
    ),
  }),
);
export const triggerAdminMonitorCheck = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: "Manual health check completed",
    data: await adminOperationsService.runAdminMonitorCheck(
      req.params.id,
      req.user,
    ),
  }),
);
export const getAdminIncidents = asyncHandler(async (req, res) => {
  const result = await adminOperationsService.listAdminIncidents(
    req.validatedQuery,
  );
  sendPaginated(res, {
    data: result.incidents,
    page: result.page,
    limit: req.validatedQuery.limit,
    total: result.total,
  });
});
export const getAdminIncidentDetails = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await adminOperationsService.getAdminIncidentDetail(req.params.id),
  }),
);
export const resolveAdminIncident = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: "Incident resolved",
    data: await adminOperationsService.resolveAdminIncident(
      req.params.id,
      req.body,
      req.user,
    ),
  }),
);

/**
 * PATCH /api/admin/users/:id/role
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserRole(
    req.params.id,
    req.body.role,
    req.user,
    req.body.reason,
  );

  sendSuccess(res, {
    message: "User role updated successfully",
    data: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
    },
  });
});

/**
 * PATCH /api/admin/users/:id/plan
 */
export const updateUserPlan = asyncHandler(async (req, res) => {
  const { user, changeType } = await adminService.updateUserPlan(
    req.params.id,
    req.body.plan,
    req.user,
    {
      reason: req.body.reason,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
    },
  );

  sendSuccess(res, {
    message: `User's plan has been ${
      changeType === "upgrade" ? "upgraded" : "downgraded"
    } to ${req.body.plan}`,
    data: {
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role,
        active: user.active,
      },
      changeType,
    },
  });
});

export const getPlanOverview = asyncHandler(async (_req, res) =>
  sendSuccess(res, { data: await adminService.getPlanOverview() }),
);

export const getUserPlanDetails = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await adminService.getUserPlanDetails(req.params.id),
  }),
);

/**
 * POST /api/admin/users/:id/suspend
 */
export const suspendUser = asyncHandler(async (req, res) => {
  const user = await adminService.suspendUser(
    req.params.id,
    req.user,
    req.body.reason,
  );

  sendSuccess(res, {
    message: "User suspended successfully",
    data: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      active: user.active,
    },
  });
});

/**
 * POST /api/admin/users/:id/reactivate
 */
export const reactivateUser = asyncHandler(async (req, res) => {
  const user = await adminService.reactivateUser(
    req.params.id,
    req.user,
    req.body.reason,
  );

  sendSuccess(res, {
    message: "User reactivated successfully",
    data: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      active: user.active,
    },
  });
});

/**
 * DELETE /api/admin/users/:id
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const result = await adminService.deleteUser(req.params.id, req.user);

  sendSuccess(res, {
    message: "User deleted successfully",
    data: result,
  });
});

// ── Controllers: plan upgrade requests ──────────────────────────────────────

/**
 * GET /api/admin/plan-upgrade-requests
 * Paginated, optionally filtered by status (defaults to every status when
 * omitted — the frontend defaults its own filter to "pending").
 */
export const listPlanUpgradeRequests = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const result = await planUpgradeRequestService.listRequestsForAdmin(query);

  sendPaginated(res, {
    data: result.requests,
    page: result.page,
    limit: query.limit,
    total: result.total,
  });
});

export const getPlanUpgradeRequest = asyncHandler(async (req, res) => {
  const request = await planUpgradeRequestService.getRequestForAdmin(
    req.params.id,
  );
  sendSuccess(res, { data: request });
});

/**
 * PATCH /api/admin/plan-upgrade-requests/:id/approve
 * Applies the requested plan change immediately and notifies the user by
 * email and in-app notification.
 */
export const approvePlanUpgradeRequest = asyncHandler(async (req, res) => {
  const { request } = await planUpgradeRequestService.approveRequest(
    req.params.id,
    req.user,
    {
      grantedPlan: req.body.grantedPlan,
      reason: req.body.reason,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
    },
  );

  sendSuccess(res, {
    message: "Upgrade request approved and the user's plan has been updated",
    data: request,
  });
});

/**
 * PATCH /api/admin/plan-upgrade-requests/:id/reject
 * Optional { reason } in the request body is shared with the user in
 * their notification and email.
 */
export const rejectPlanUpgradeRequest = asyncHandler(async (req, res) => {
  const request = await planUpgradeRequestService.rejectRequest(
    req.params.id,
    req.user,
    { reason: req.body.reason },
  );

  sendSuccess(res, {
    message: "Upgrade request rejected",
    data: request,
  });
});
