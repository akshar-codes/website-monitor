/**
 * Monitor routes
 *
 * POST   /api/monitors      — create
 * GET    /api/monitors      — list (paginated)
 * GET    /api/monitors/:id  — get by id
 * PUT    /api/monitors/:id  — update
 * DELETE /api/monitors/:id  — delete
 */

const { Router } = require("express");
const {
  createMonitor,
  getMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
} = require("../controllers/monitor.controller");

const router = Router();

router.route("/").post(createMonitor).get(getMonitors);

router.route("/:id").get(getMonitorById).put(updateMonitor).delete(deleteMonitor);

module.exports = router;
