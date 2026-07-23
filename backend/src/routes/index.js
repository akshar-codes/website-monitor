/**
 * Central route aggregator
 * All feature routers are mounted here and then plugged into app.js once.
 */

import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import planRoutes from "./plan.routes.js";
import monitorRoutes from "./monitor.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import incidentRoutes from "./incident.routes.js";
import adminRoutes from "./admin.routes.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { ROLES } from "../config/constants.js";

const router = Router();

// ── Public ──
// (planRoutes is public at its mount point — GET /api/plans/current and
// POST /api/plans/change are individually guarded by isAuthenticated
// inside plan.routes.js, mirroring how authRoutes self-guards internally.)
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/plans", planRoutes);

// ── Requires an authenticated session ──
router.use("/monitors", isAuthenticated, monitorRoutes);
router.use("/dashboard", isAuthenticated, dashboardRoutes);
router.use("/incidents", isAuthenticated, incidentRoutes);

// ── Requires an authenticated session AND the admin role ──
router.use("/admin", isAuthenticated, authorize(ROLES.ADMIN), adminRoutes);

export default router;
