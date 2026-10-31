import { Router } from "express";
import { z } from "zod";
import * as controller from "../controllers/alerting.controller.js";
import { requirePermission } from "../middlewares/permission.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  integrationCreateSchema,
  integrationUpdateSchema,
  deliveryQuerySchema,
} from "../validators/alerting.validator.js";
import { integrationTestLimiter } from "../middlewares/rateLimiter.js";

const router = Router();
router.get(
  "/deliveries",
  requirePermission("integration:read"),
  validate(deliveryQuerySchema, "query"),
  controller.listDeliveries,
);
router.post(
  "/deliveries/:id/retry",
  requirePermission("integration:update"),
  validateObjectId("id"),
  controller.retryDelivery,
);
router.get(
  "/",
  requirePermission("integration:read"),
  controller.listIntegrations,
);
router.post(
  "/",
  requirePermission("integration:create"),
  validate(integrationCreateSchema, "body"),
  controller.createIntegration,
);
router.get(
  "/:id",
  requirePermission("integration:read"),
  validateObjectId("id"),
  controller.getIntegration,
);
router.patch(
  "/:id",
  requirePermission("integration:update"),
  validateObjectId("id"),
  validate(integrationUpdateSchema, "body"),
  controller.updateIntegration,
);
router.post(
  "/:id/test",
  requirePermission("integration:update"),
  integrationTestLimiter,
  validateObjectId("id"),
  validate(z.object({}).strict(), "body"),
  controller.testIntegration,
);
router.post(
  "/:id/enable",
  requirePermission("integration:update"),
  validateObjectId("id"),
  controller.enableIntegration,
);
router.post(
  "/:id/disable",
  requirePermission("integration:update"),
  validateObjectId("id"),
  controller.disableIntegration,
);
router.delete(
  "/:id",
  requirePermission("integration:delete"),
  validateObjectId("id"),
  controller.deleteIntegration,
);
export default router;
