import { Router } from "express";
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  revokeApiKey,
} from "../controllers/apiKey.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { createApiKeySchema } from "../validators/apiKey.validator.js";
import { requireMinPlan } from "../middlewares/planAuthorization.js";

const router = Router();
router.get("/", listApiKeys);
router.post(
  "/",
  requireMinPlan("pro"),
  validate(createApiKeySchema, "body"),
  createApiKey,
);
router.post("/:id/revoke", validateObjectId("id"), revokeApiKey);
router.delete("/:id", validateObjectId("id"), deleteApiKey);
export default router;
