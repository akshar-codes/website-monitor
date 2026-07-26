import asyncHandler from "../utils/asyncHandler.js";
import * as adminService from "../services/admin.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

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

/**
 * PATCH /api/admin/users/:id/role
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserRole(
    req.params.id,
    req.body.role,
    req.user,
  );

  sendSuccess(res, {
    message: "User role updated successfully",
    data: user,
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
  );

  sendSuccess(res, {
    message: `User's plan has been ${
      changeType === "upgrade" ? "upgraded" : "downgraded"
    } to ${req.body.plan}`,
    data: { user, changeType },
  });
});

/**
 * POST /api/admin/users/:id/suspend
 */
export const suspendUser = asyncHandler(async (req, res) => {
  const user = await adminService.suspendUser(req.params.id, req.user);

  sendSuccess(res, {
    message: "User suspended successfully",
    data: user,
  });
});

/**
 * POST /api/admin/users/:id/reactivate
 */
export const reactivateUser = asyncHandler(async (req, res) => {
  const user = await adminService.reactivateUser(req.params.id, req.user);

  sendSuccess(res, {
    message: "User reactivated successfully",
    data: user,
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
