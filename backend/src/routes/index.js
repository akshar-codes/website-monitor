/**
 * Central route aggregator
 * All feature routers are mounted here and then plugged into app.js once.
 */

import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import monitorRoutes from "./monitor.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import incidentRoutes from "./incident.routes.js";
import adminRoutes from "./admin.routes.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { ROLES } from "../config/constants.js";

const router = Router();

// ── Public ──
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);

// ── Requires an authenticated session ──
router.use("/monitors", isAuthenticated, monitorRoutes);
router.use("/dashboard", isAuthenticated, dashboardRoutes);
router.use("/incidents", isAuthenticated, incidentRoutes);

// ── Requires an authenticated session AND the admin role ──
router.use("/admin", isAuthenticated, authorize(ROLES.ADMIN), adminRoutes);

export default router;
