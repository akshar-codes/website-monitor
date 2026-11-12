import { Router } from "express";
import express from "express";
import {
  createIntegration,
  listIntegrations,
  rotateIntegrationSecret,
  revokeIntegration,
  deleteIntegration,
  ingestDeploymentEvent,
  listDeploymentEvents,
  getDeploymentEvent,
} from "../controllers/deployment.controller.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { deploymentAuth } from "../middlewares/deploymentAuth.js";
import { deploymentIngestionLimiter } from "../middlewares/rateLimiter.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import {
  createDeploymentIntegrationSchema,
  rotateDeploymentSecretSchema,
  ingestDeploymentEventSchema,
  listDeploymentEventsQuerySchema,
} from "../validators/deployment.validator.js";

const router = Router();

// Ingestion endpoints (external CI/CD authenticated via deployment credentials)
router.post(
  "/events",
  deploymentIngestionLimiter,
  deploymentAuth,
  validate(ingestDeploymentEventSchema, "body"),
  ingestDeploymentEvent,
);

router.post(
  "/",
  deploymentIngestionLimiter,
  deploymentAuth,
  validate(ingestDeploymentEventSchema, "body"),
  ingestDeploymentEvent,
);

// Integration management routes (session authenticated)
router.get("/integrations", isAuthenticated, listIntegrations);

router.post(
  "/integrations",
  isAuthenticated,
  validate(createDeploymentIntegrationSchema, "body"),
  createIntegration,
);

router.post(
  "/integrations/:id/rotate",
  isAuthenticated,
  validateObjectId("id"),
  validate(rotateDeploymentSecretSchema, "body"),
  rotateIntegrationSecret,
);

router.post(
  "/integrations/:id/revoke",
  isAuthenticated,
  validateObjectId("id"),
  revokeIntegration,
);

router.delete(
  "/integrations/:id",
  isAuthenticated,
  validateObjectId("id"),
  deleteIntegration,
);

// Deployment queries (session authenticated)
router.get(
  "/events",
  isAuthenticated,
  validate(listDeploymentEventsQuerySchema, "query"),
  listDeploymentEvents,
);

router.get(
  "/events/:id",
  isAuthenticated,
  validateObjectId("id"),
  getDeploymentEvent,
);

router.get(
  "/",
  isAuthenticated,
  validate(listDeploymentEventsQuerySchema, "query"),
  listDeploymentEvents,
);

export default router;
