/**
 * Dashboard routes
 *
 * GET /api/dashboard/overview                  — main dashboard (aggregated)
 * GET /api/dashboard/incidents                 — active incidents (paginated)
 * GET /api/dashboard/health-checks             — recent checks (filterable)
 * GET /api/dashboard/monitors/:id/stats        — per-monitor detail stats
 * GET /api/dashboard/monitors/:id/chart-data   — per-monitor chart data
 */

import { Router } from "express";
import {
  getOverview,
  getActiveIncidents,
  getRecentHealthChecks,
  getMonitorStats,
  getMonitorChartData,
} from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/overview", getOverview);
router.get("/incidents", getActiveIncidents);
router.get("/health-checks", getRecentHealthChecks);
router.get("/monitors/:id/stats", getMonitorStats);
router.get("/monitors/:id/chart-data", getMonitorChartData);

export default router;
