import { Router } from "express";
import * as controller from "../controllers/alerting.controller.js";
import { requirePermission } from "../middlewares/permission.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  alertPolicySchema,
  alertPolicyUpdateSchema,
} from "../validators/alerting.validator.js";

const router = Router();
router.use(requirePermission("alert:manage"));
router.get("/", controller.listPolicies);
router.post(
  "/test",
  validate(alertPolicySchema, "body"),
  controller.testPolicy,
);
router.post("/", validate(alertPolicySchema, "body"), controller.createPolicy);
router.patch(
  "/:id",
  validateObjectId("id"),
  validate(alertPolicyUpdateSchema, "body"),
  controller.updatePolicy,
);
router.delete("/:id", validateObjectId("id"), controller.deletePolicy);
export default router;
