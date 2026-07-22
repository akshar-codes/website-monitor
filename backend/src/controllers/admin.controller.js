import asyncHandler from "../utils/asyncHandler.js";
import * as adminService from "../services/admin.service.js";
import { sendSuccess, sendPaginated } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
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
