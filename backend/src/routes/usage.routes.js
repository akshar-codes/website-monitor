/**
 * Usage routes
 *
 * GET /api/usage — the caller's current usage against their plan's limits
 *
 * Authentication is enforced at the mount point (routes/index.js);
 * "usage:read" is granted to every role (see config/permissions.js) but
 * is checked explicitly here for consistency with every other resource
 * router in the app.
 */

import { Router } from "express";
import { getUsage } from "../controllers/usage.controller.js";
import { requirePermission } from "../middlewares/permission.js";

const router = Router();

router.get("/", requirePermission("usage:read"), getUsage);

export default router;
