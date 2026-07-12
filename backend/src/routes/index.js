/**
 * Central route aggregator
 * All feature routers are mounted here and then plugged into app.js once.
 */

import { Router } from "express";
import healthRoutes from "./health.routes.js";
import monitorRoutes from "./monitor.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import incidentRoutes from "./incident.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/monitors", monitorRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/incidents", incidentRoutes);

export default router;
