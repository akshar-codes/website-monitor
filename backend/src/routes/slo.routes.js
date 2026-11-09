import { Router } from "express";
import {
  createSlo,
  getSlos,
  getSloById,
  updateSlo,
  deleteSlo,
} from "../controllers/slo.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import {
  createSloSchema,
  updateSloSchema,
  listSlosSchema,
} from "../validators/slo.validator.js";

const router = Router();

router
  .route("/")
  .post(
    requirePermission("slo:create"),
    validate(createSloSchema, "body"),
    createSlo,
  )
  .get(
    requirePermission("slo:read"),
    validate(listSlosSchema, "query"),
    getSlos,
  );

router
  .route("/:id")
  .get(requirePermission("slo:read"), validateObjectId("id"), getSloById)
  .put(
    requirePermission("slo:update"),
    validateObjectId("id"),
    validate(updateSloSchema, "body"),
    updateSlo,
  )
  .patch(
    requirePermission("slo:update"),
    validateObjectId("id"),
    validate(updateSloSchema, "body"),
    updateSlo,
  )
  .delete(requirePermission("slo:delete"), validateObjectId("id"), deleteSlo);

export default router;
