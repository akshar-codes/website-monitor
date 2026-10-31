import { Router } from "express";
import * as controller from "../controllers/alerting.controller.js";
import { requirePermission } from "../middlewares/permission.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  notificationRuleSchema,
  notificationRuleUpdateSchema,
} from "../validators/alerting.validator.js";

const router = Router();
router.use(requirePermission("alert:manage"));
router.get("/", controller.listRules);
router.post(
  "/",
  validate(notificationRuleSchema, "body"),
  controller.createRule,
);
router.patch(
  "/:id",
  validateObjectId("id"),
  validate(notificationRuleUpdateSchema, "body"),
  controller.updateRule,
);
router.delete("/:id", validateObjectId("id"), controller.deleteRule);
export default router;
