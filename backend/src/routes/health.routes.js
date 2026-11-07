/**
 * Health-check route
 * GET /api/health
 */

import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import env from "../config/env.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

const matchesApiKey = (provided) => {
  if (!env.HEALTH_API_KEY || typeof provided !== "string") return false;
  const expected = Buffer.from(env.HEALTH_API_KEY);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const healthAccessAllowed = (req) => {
  const hasIpRules = env.HEALTH_IP_ALLOWLIST.length > 0;
  const hasApiKey = Boolean(env.HEALTH_API_KEY);
  if (!hasIpRules && !hasApiKey) return true;

  const ipAllowed = hasIpRules && env.HEALTH_IP_ALLOWLIST.includes(req.ip);
  const bearer = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const keyAllowed =
    hasApiKey && (matchesApiKey(req.get("x-api-key")) || matchesApiKey(bearer));
  return ipAllowed || keyAllowed;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!healthAccessAllowed(req)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

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
  }),
);

export default router;
