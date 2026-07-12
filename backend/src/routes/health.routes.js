/**
 * Health-check route
 * GET /api/health
 */

import { Router } from "express";
import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const mongoState = mongoose.connection.readyState;
    const stateMap = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    res.json({
      success: true,
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      mongo: stateMap[mongoState] || "unknown",
    });
  })
);

export default router;
