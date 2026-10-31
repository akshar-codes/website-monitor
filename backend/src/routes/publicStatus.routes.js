import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validate.js";
import {
  getPublic,
  getPublicServices,
  getPublicIncidents,
  getPublicMaintenance,
  getPublicUptime,
  subscribe,
  verifySubscription,
  unsubscribe,
  getSubscriberPreferences,
  updateSubscriberPreferences,
} from "../controllers/statusPage.controller.js";
import {
  statusSubscriptionLimiter,
  statusTokenLimiter,
} from "../middlewares/rateLimiter.js";
import {
  subscriptionSchema,
  tokenSchema,
  uptimeRangeSchema,
  updatePreferencesSchema,
} from "../validators/statusPage.validator.js";
const router = Router();
const slugParams = validate(
  z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
  "params",
);
router.get(
  "/:slug",
  slugParams,
  validate(uptimeRangeSchema, "query"),
  getPublic,
);
router.get("/:slug/services", slugParams, getPublicServices);
router.get("/:slug/incidents", slugParams, getPublicIncidents);
router.get("/:slug/maintenance", slugParams, getPublicMaintenance);
router.get(
  "/:slug/uptime",
  slugParams,
  validate(uptimeRangeSchema, "query"),
  getPublicUptime,
);
router.post(
  "/:slug/subscribe",
  statusSubscriptionLimiter,
  slugParams,
  validate(subscriptionSchema),
  subscribe,
);
router.post(
  "/verify-subscription",
  statusTokenLimiter,
  validate(tokenSchema),
  verifySubscription,
);
router.post(
  "/unsubscribe",
  statusTokenLimiter,
  validate(tokenSchema),
  unsubscribe,
);
router.post(
  "/subscription-preferences/read",
  statusTokenLimiter,
  validate(tokenSchema),
  getSubscriberPreferences,
);
router.post(
  "/subscription-preferences",
  statusTokenLimiter,
  validate(updatePreferencesSchema),
  updateSubscriberPreferences,
);
export default router;
