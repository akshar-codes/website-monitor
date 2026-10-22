/**
 * Central route aggregator
 * All feature routers are mounted here and then plugged into app.js once.
 */

import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import profileRoutes from "./profile.routes.js";
import accountRoutes from "./account.routes.js";
import preferenceRoutes from "./preference.routes.js";
import planRoutes from "./plan.routes.js";
import planUpgradeRequestRoutes from "./planUpgradeRequest.routes.js";
import usageRoutes from "./usage.routes.js";
import monitorRoutes from "./monitor.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import incidentRoutes from "./incident.routes.js";
import sslRoutes from "./ssl.routes.js";
import activityRoutes from "./activity.routes.js";
import notificationRoutes from "./notification.routes.js";
import adminRoutes from "./admin.routes.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { ROLES } from "../config/constants.js";

const router = Router();

// ── Public ──
// (profileRoutes and planRoutes are public at their mount point — each
// individually guards its authenticated routes with isAuthenticated
// internally, mirroring how authRoutes self-guards internally, so that
// public sub-routes like GET /profile/public/:id and GET /plans/current's
// catalog sibling stay reachable without a session.)
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/account", accountRoutes);
router.use("/plans", planRoutes);

// ── Requires an authenticated session ──
router.use("/preferences", isAuthenticated, preferenceRoutes);
router.use("/usage", isAuthenticated, usageRoutes);
router.use("/monitors", isAuthenticated, monitorRoutes);
router.use("/dashboard", isAuthenticated, dashboardRoutes);
router.use("/incidents", isAuthenticated, incidentRoutes);
router.use("/ssl", isAuthenticated, sslRoutes);
router.use("/activity", isAuthenticated, activityRoutes);
router.use("/notifications", isAuthenticated, notificationRoutes);
router.use("/plan-upgrade-requests", isAuthenticated, planUpgradeRequestRoutes);

// ── Requires an authenticated session AND the admin role ──
router.use("/admin", isAuthenticated, authorize(ROLES.ADMIN), adminRoutes);

export default router;
