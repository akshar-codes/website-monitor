/**
 * Usage routes
 *
 * GET /api/usage — the caller's current usage against their plan's limits
 */

import { Router } from "express";
import { getUsage } from "../controllers/usage.controller.js";

const router = Router();

router.get("/", getUsage);

export default router;
