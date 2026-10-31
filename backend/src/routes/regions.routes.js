import { Router } from "express";
import { requirePermission } from "../middlewares/permission.js";
import { listRegions } from "../controllers/regions.controller.js";

const router = Router();
router.get("/", requirePermission("monitor:read"), listRegions);
export default router;
