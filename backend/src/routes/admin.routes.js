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
 */

import { Router } from "express";
import {
  getUsers,
  updateUserRole,
  updateUserPlan,
  suspendUser,
  reactivateUser,
  deleteUser,
} from "../controllers/admin.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  listUsersSchema,
  updateUserRoleSchema,
  updateUserPlanSchema,
} from "../validators/admin.validator.js";

const router = Router();

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

export default router;
