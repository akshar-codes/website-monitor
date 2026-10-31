import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validate.js";
import { probeAgentLimiter } from "../middlewares/rateLimiter.js";
import * as controller from "../controllers/internalProbe.controller.js";

const resultSchema = z
  .object({
    leaseToken: z.string().min(20).max(100),
    healthStatus: z.enum(["up", "down", "degraded", "unknown"]),
    frontendStatus: z.string().max(30).optional().default("unknown"),
    backendStatus: z.string().max(30).optional().default("unknown"),
    databaseStatus: z.string().max(30).optional().default("unknown"),
    responseTime: z.number().min(0),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    failureReason: z.string().max(100).nullable().optional(),
    timings: z
      .object({
        dnsMs: z.number().min(0).nullable(),
        tcpConnectMs: z.number().min(0).nullable(),
        tlsHandshakeMs: z.number().min(0).nullable(),
        ttfbMs: z.number().min(0).nullable(),
        downloadMs: z.number().min(0).nullable(),
        totalMs: z.number().min(0).nullable(),
      })
      .strict(),
    checkedAt: z.coerce.date(),
  })
  .strict();

const router = Router();
router.use(probeAgentLimiter);
router.post(
  "/heartbeat",
  validate(
    z.object({ version: z.string().max(50).optional() }).strict(),
    "body",
  ),
  controller.heartbeat,
);
router.post(
  "/claim",
  validate(z.object({}).strict(), "body"),
  controller.claim,
);
router.post(
  "/:id/result",
  validate(resultSchema, "body"),
  controller.submitResult,
);
export default router;
