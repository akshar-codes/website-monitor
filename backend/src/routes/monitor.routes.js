/**
 * Monitor routes
 *
 * POST   /api/monitors      — create
 * GET    /api/monitors      — list (paginated)
 * GET    /api/monitors/:id  — get by id
 * PUT    /api/monitors/:id  — update
 * DELETE /api/monitors/:id  — delete
 */

import { Router } from "express";
import {
  createMonitor,
  getMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
} from "../controllers/monitor.controller.js";

const router = Router();

router.route("/").post(createMonitor).get(getMonitors);

router.route("/:id").get(getMonitorById).put(updateMonitor).delete(deleteMonitor);

export default router;
