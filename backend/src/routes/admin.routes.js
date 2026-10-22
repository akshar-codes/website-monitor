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
  getAdminMonitors,
  getAdminMonitorDetails,
  triggerAdminMonitorCheck,
  getAdminIncidents,
  getAdminIncidentDetails,
  resolveAdminIncident,
  getUsers,
  getUserDetails,
  getPlanOverview,
  getUserPlanDetails,
  updateUserRole,
  updateUserPlan,
  suspendUser,
  reactivateUser,
  deleteUser,
  listPlanUpgradeRequests,
  getPlanUpgradeRequest,
  approvePlanUpgradeRequest,
  rejectPlanUpgradeRequest,
} from "../controllers/admin.controller.js";
import { adminDashboardQuerySchema } from "../validators/adminDashboard.validator.js";
import {
  adminMonitorListSchema,
  adminIncidentListSchema,
  adminMonitorDetailSchema,
  resolveAdminIncidentSchema,
} from "../validators/adminOperations.validator.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  listUsersSchema,
  updateUserRoleSchema,
  updateUserPlanSchema,
  userStatusReasonSchema,
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
router.get(
  "/monitors",
  validate(adminMonitorListSchema, "query"),
  getAdminMonitors,
);
router.get(
  "/monitors/:id",
  validateObjectId("id"),
  validate(adminMonitorDetailSchema, "query"),
  getAdminMonitorDetails,
);
router.post(
  "/monitors/:id/check",
  validateObjectId("id"),
  triggerAdminMonitorCheck,
);
router.get(
  "/incidents",
  validate(adminIncidentListSchema, "query"),
  getAdminIncidents,
);
router.get("/incidents/:id", validateObjectId("id"), getAdminIncidentDetails);
router.post(
  "/incidents/:id/resolve",
  validateObjectId("id"),
  validate(resolveAdminIncidentSchema, "body"),
  resolveAdminIncident,
);

router.get("/users", validate(listUsersSchema, "query"), getUsers);
router.get("/plans/overview", getPlanOverview);
router.get("/users/:id/plan", validateObjectId("id"), getUserPlanDetails);
router.get("/users/:id", validateObjectId("id"), getUserDetails);

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

router.post(
  "/users/:id/suspend",
  validateObjectId("id"),
  validate(userStatusReasonSchema, "body"),
  suspendUser,
);

router.post(
  "/users/:id/reactivate",
  validateObjectId("id"),
  validate(userStatusReasonSchema, "body"),
  reactivateUser,
);

router.delete("/users/:id", validateObjectId("id"), deleteUser);

// ── Plan upgrade requests ──

router.get(
  "/plan-upgrade-requests",
  validate(listPlanUpgradeRequestsSchema, "query"),
  listPlanUpgradeRequests,
);
router.get(
  "/plan-upgrade-requests/:id",
  validateObjectId("id"),
  getPlanUpgradeRequest,
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
