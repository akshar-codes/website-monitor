import { Router } from "express";
import * as controller from "../controllers/statusPage.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import {
  createStatusPageSchema,
  updateStatusPageSchema,
  serviceSchema,
} from "../validators/statusPage.validator.js";
const router = Router();
router.get("/", requirePermission("status-page:read"), controller.list);
router.post(
  "/",
  requirePermission("status-page:create"),
  validate(createStatusPageSchema),
  controller.create,
);
router.get(
  "/:id",
  requirePermission("status-page:read"),
  validateObjectId(),
  controller.get,
);
router.patch(
  "/:id",
  requirePermission("status-page:update"),
  validateObjectId(),
  validate(updateStatusPageSchema),
  controller.update,
);
router.delete(
  "/:id",
  requirePermission("status-page:delete"),
  validateObjectId(),
  controller.remove,
);
router.post(
  "/:id/publish",
  requirePermission("status-page:update"),
  validateObjectId(),
  controller.publish,
);
router.post(
  "/:id/unpublish",
  requirePermission("status-page:update"),
  validateObjectId(),
  controller.unpublish,
);
router.post(
  "/:id/services",
  requirePermission("status-page:update"),
  validateObjectId(),
  validate(serviceSchema),
  controller.addService,
);
router.patch(
  "/:id/services/:serviceId",
  requirePermission("status-page:update"),
  validateObjectId(),
  validateObjectId("serviceId"),
  validate(serviceSchema.omit({ monitorId: true }).partial()),
  controller.updateService,
);
router.delete(
  "/:id/services/:serviceId",
  requirePermission("status-page:update"),
  validateObjectId(),
  validateObjectId("serviceId"),
  controller.removeService,
);
export default router;
