/**
 * Central route aggregator
 * All feature routers are mounted here and then plugged into app.js once.
 */

const { Router } = require("express");
const healthRoutes = require("./health.routes");
const monitorRoutes = require("./monitor.routes");
const dashboardRoutes = require("./dashboard.routes");
const incidentRoutes = require("./incident.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/monitors", monitorRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/incidents", incidentRoutes);

module.exports = router;
