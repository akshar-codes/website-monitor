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
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  createMonitorSchema,
  updateMonitorSchema,
  listMonitorsSchema,
} from "../validators/monitor.validator.js";

const router = Router();

router
  .route("/")
  .post(validate(createMonitorSchema, "body"), createMonitor)
  .get(validate(listMonitorsSchema, "query"), getMonitors);

router
  .route("/:id")
  .get(validateObjectId("id"), getMonitorById)
  .put(
    validateObjectId("id"),
    validate(updateMonitorSchema, "body"),
    updateMonitor,
  )
  .delete(validateObjectId("id"), deleteMonitor);

export default router;
