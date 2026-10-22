import { Router } from "express";
import { getMonitor, listMonitors } from "../controllers/apiV1.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { listMonitorsSchema } from "../validators/monitor.validator.js";

const router = Router();
// API keys are intentionally read-only and owner-scoped; write and admin routes stay session-only.
router.get("/monitors", validate(listMonitorsSchema, "query"), listMonitors);
router.get("/monitors/:id", validateObjectId("id"), getMonitor);
export default router;
