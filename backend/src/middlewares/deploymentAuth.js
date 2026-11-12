import ApiError from "../utils/ApiError.js";
import {
  authenticateDeploymentSecret,
  authenticateDeploymentSignature,
  recordDeploymentIntegrationUse,
} from "../services/deployment.service.js";

/**
 * Dedicated authentication middleware for external CI/CD deployment event reporting.
 *
 * Supports:
 * 1. Bearer Token via Authorization: Bearer <secret> or x-deployment-token / x-deployment-key
 * 2. HMAC-SHA256 signature via x-deployment-signature / x-signature / x-hub-signature-256
 *
 * General API keys (wm_live_*) are explicitly rejected here to preserve
 * their read-only behavior.
 */
export const deploymentAuth = async (req, _res, next) => {
  try {
    let token = null;
    const authHeader = req.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.get("x-deployment-token")) {
      token = req.get("x-deployment-token").trim();
    } else if (req.get("x-deployment-key")) {
      token = req.get("x-deployment-key").trim();
    } else if (req.get("x-api-key")) {
      token = req.get("x-api-key").trim();
    }

    const signature =
      req.get("x-deployment-signature") ||
      req.get("x-signature") ||
      req.get("x-hub-signature-256");

    // 1. Signature-based authentication
    if (signature) {
      const keyIdentifier =
        req.get("x-deployment-key-id") ||
        req.get("x-deployment-prefix") ||
        req.get("x-deployment-key") ||
        (token && !token.includes("_") ? token : null);

      if (!keyIdentifier) {
        return next(
          ApiError.unauthorized(
            "Signature authentication requires key identifier via x-deployment-key-id or x-deployment-prefix",
          ),
        );
      }

      const rawBody = req.rawBody
        ? req.rawBody.toString("utf8")
        : JSON.stringify(req.body || {});

      const sigResult = await authenticateDeploymentSignature({
        keyIdentifier,
        signature,
        rawBody,
      });

      if (!sigResult) {
        return next(ApiError.unauthorized("Invalid deployment signature"));
      }

      if (sigResult.error === "REVOKED") {
        return next(
          ApiError.unauthorized("Deployment credential has been revoked"),
        );
      }

      req.deploymentIntegration = sigResult.integration;
      req.user = sigResult.user;
      recordDeploymentIntegrationUse(sigResult.integration._id);
      return next();
    }

    // 2. Token-based authentication
    if (!token) {
      return next(
        ApiError.unauthorized(
          "Deployment authentication required. Provide Authorization: Bearer <token> or deployment signature.",
        ),
      );
    }

    // Explicit rejection of general API keys to preserve read-only v1 behavior
    if (token.startsWith("wm_live_")) {
      return next(
        ApiError.unauthorized(
          "General API keys cannot be used for deployment ingestion. Use a dedicated deployment integration secret.",
        ),
      );
    }

    const result = await authenticateDeploymentSecret(token);

    if (!result) {
      return next(
        ApiError.unauthorized("Invalid deployment integration credentials"),
      );
    }

    if (result.error === "REVOKED") {
      return next(
        ApiError.unauthorized("Deployment credential has been revoked"),
      );
    }

    req.deploymentIntegration = result.integration;
    req.user = result.user;
    recordDeploymentIntegrationUse(result.integration._id);
    return next();
  } catch (error) {
    return next(error);
  }
};
