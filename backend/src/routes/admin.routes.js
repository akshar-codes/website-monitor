/**
 * Admin routes
 *
 * Every route in this router requires an authenticated session AND the
 * "admin" role — both are enforced once, at the mount point, in
 * routes/index.js (`isAuthenticated` + `authorize(ROLES.ADMIN)`), rather
 * than repeated on each route here.
 *
 * GET   /api/admin/users          — list users (paginated, filterable by role)
 * PATCH /api/admin/users/:id/role — change a user's role
 */

import { Router } from "express";
import { getUsers, updateUserRole } from "../controllers/admin.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  listUsersSchema,
  updateUserRoleSchema,
} from "../validators/admin.validator.js";

const router = Router();

router.get("/users", validate(listUsersSchema, "query"), getUsers);

router.patch(
  "/users/:id/role",
  validateObjectId("id"),
  validate(updateUserRoleSchema, "body"),
  updateUserRole,
);

export default router;
