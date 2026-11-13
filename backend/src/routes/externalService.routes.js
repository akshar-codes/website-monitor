import { Router } from "express";
import {
  createExternalService,
  getExternalServices,
  getExternalServiceById,
  updateExternalService,
  deleteExternalService,
} from "../controllers/externalService.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import {
  createExternalServiceSchema,
  updateExternalServiceSchema,
} from "../validators/externalService.validator.js";

const router = Router();

router.post(
  "/",
  requirePermission("external-service:create"),
  validate(createExternalServiceSchema),
  createExternalService,
);

router.get(
  "/",
  requirePermission("external-service:read"),
  getExternalServices,
);

router.get(
  "/:id",
  requirePermission("external-service:read"),
  validateObjectId("id"),
  getExternalServiceById,
);

router.put(
  "/:id",
  requirePermission("external-service:update"),
  validateObjectId("id"),
  validate(updateExternalServiceSchema),
  updateExternalService,
);

router.delete(
  "/:id",
  requirePermission("external-service:delete"),
  validateObjectId("id"),
  deleteExternalService,
);

export default router;
