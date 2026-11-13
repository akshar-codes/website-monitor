import { Router } from "express";
import {
  getDependencyGraph,
  getDependencies,
  getMonitorDependencies,
  createDependency,
  validateProposedDependency,
  updateDependency,
  deleteDependency,
} from "../controllers/dependency.controller.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { requirePermission } from "../middlewares/permission.js";
import { requireWithinLimit } from "../middlewares/featureAccess.js";
import { getDependencyLimit } from "../utils/planUtils.js";
import { countOwnedDependencies } from "../services/dependency.service.js";
import {
  createDependencySchema,
  updateDependencySchema,
  listDependenciesSchema,
  getGraphQuerySchema,
  validateDependencySchema,
} from "../validators/dependency.validator.js";

const router = Router();

router.get(
  "/graph",
  requirePermission("dependency:read"),
  validate(getGraphQuerySchema, "query"),
  getDependencyGraph,
);

router.get(
  "/monitor/:id",
  requirePermission("dependency:read"),
  validateObjectId("id"),
  getMonitorDependencies,
);

router.post(
  "/validate",
  requirePermission("dependency:read"),
  validate(validateDependencySchema),
  validateProposedDependency,
);

router.get(
  "/",
  requirePermission("dependency:read"),
  validate(listDependenciesSchema, "query"),
  getDependencies,
);

router.post(
  "/",
  requirePermission("dependency:create"),
  requireWithinLimit({
    limitFn: getDependencyLimit,
    countFn: (req) => countOwnedDependencies(req.user),
    resourceName: "dependency",
  }),
  validate(createDependencySchema),
  createDependency,
);

router.put(
  "/:id",
  requirePermission("dependency:update"),
  validateObjectId("id"),
  validate(updateDependencySchema),
  updateDependency,
);

router.delete(
  "/:id",
  requirePermission("dependency:delete"),
  validateObjectId("id"),
  deleteDependency,
);

export default router;
