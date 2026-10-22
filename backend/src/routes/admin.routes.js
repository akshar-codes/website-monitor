/**
 * Admin routes
 *
 * Every route in this router requires an authenticated session AND the
 * "admin" role — both are enforced once, at the mount point, in
 * routes/index.js (`isAuthenticated` + `authorize(ROLES.ADMIN)`), rather
 * than repeated on each route here.
 *
 * GET    /api/admin/users               — list/search/filter users (paginated)
 * PATCH  /api/admin/users/:id/role       — change a user's role
 * PATCH  /api/admin/users/:id/plan       — change a user's subscription plan
 * POST   /api/admin/users/:id/suspend    — suspend a user account
 * POST   /api/admin/users/:id/reactivate — reactivate a suspended account
 * DELETE /api/admin/users/:id            — permanently delete a user account
 *
 * GET   /api/admin/plan-upgrade-requests             — list plan upgrade requests (filter: status)
 * PATCH /api/admin/plan-upgrade-requests/:id/approve — approve a pending request (applies the plan change)
 * PATCH /api/admin/plan-upgrade-requests/:id/reject  — reject a pending request (optional reason)
 */

import { Router } from "express";
import {
  getAdminDashboard,
  getUsers,
  updateUserRole,
  updateUserPlan,
  suspendUser,
  reactivateUser,
  deleteUser,
  listPlanUpgradeRequests,
  approvePlanUpgradeRequest,
  rejectPlanUpgradeRequest,
} from "../controllers/admin.controller.js";
import { adminDashboardQuerySchema } from "../validators/adminDashboard.validator.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  listUsersSchema,
  updateUserRoleSchema,
  updateUserPlanSchema,
} from "../validators/admin.validator.js";
import {
  listPlanUpgradeRequestsSchema,
  rejectPlanUpgradeRequestSchema,
  approvePlanUpgradeRequestSchema,
} from "../validators/planUpgradeRequest.validator.js";

const router = Router();

router.get(
  "/dashboard",
  validate(adminDashboardQuerySchema, "query"),
  getAdminDashboard,
);

router.get("/users", validate(listUsersSchema, "query"), getUsers);

router.patch(
  "/users/:id/role",
  validateObjectId("id"),
  validate(updateUserRoleSchema, "body"),
  updateUserRole,
);

router.patch(
  "/users/:id/plan",
  validateObjectId("id"),
  validate(updateUserPlanSchema, "body"),
  updateUserPlan,
);

router.post("/users/:id/suspend", validateObjectId("id"), suspendUser);

router.post("/users/:id/reactivate", validateObjectId("id"), reactivateUser);

router.delete("/users/:id", validateObjectId("id"), deleteUser);

// ── Plan upgrade requests ──

router.get(
  "/plan-upgrade-requests",
  validate(listPlanUpgradeRequestsSchema, "query"),
  listPlanUpgradeRequests,
);

router.patch(
  "/plan-upgrade-requests/:id/approve",
  validateObjectId("id"),
  validate(approvePlanUpgradeRequestSchema, "body"),
  approvePlanUpgradeRequest,
);

router.patch(
  "/plan-upgrade-requests/:id/reject",
  validateObjectId("id"),
  validate(rejectPlanUpgradeRequestSchema, "body"),
  rejectPlanUpgradeRequest,
);

export default router;
