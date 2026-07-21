/**
 * OAuth routes
 *
 * GET /api/auth/google            — redirect to Google's consent screen
 * GET /api/auth/google/callback    — Google redirects back here
 * GET /api/auth/github             — redirect to GitHub's consent screen
 * GET /api/auth/github/callback    — GitHub redirects back here
 *
 * Each pair is only mounted when that provider is fully configured (see
 * config/oauth/providers.config.js) — an unconfigured provider simply
 * doesn't exist as a route rather than 500ing at request time.
 */

import { Router } from "express";
import passport from "../config/passport.js";
import { googleCallback, githubCallback } from "../controllers/oauth.controller.js";
import { authLimiter } from "../middlewares/rateLimiter.js";
import { isGuest } from "../middlewares/authenticate.js";
import {
  PROVIDER_DEFINITIONS,
  getEnabledProviders,
} from "../config/oauth/providers.config.js";
import { OAUTH_PROVIDERS } from "../config/constants.js";

const router = Router();
const enabled = getEnabledProviders();

if (enabled[OAUTH_PROVIDERS.GOOGLE]) {
  router.get(
    "/google",
    isGuest,
    authLimiter,
    passport.authenticate(OAUTH_PROVIDERS.GOOGLE, {
      scope: PROVIDER_DEFINITIONS[OAUTH_PROVIDERS.GOOGLE].scope,
      session: true,
    }),
  );

  // Not guarded by isGuest — the provider redirects back here regardless
  // of the caller's session state, and the callback itself decides what
  // to do with the resolved identity.
  router.get("/google/callback", googleCallback);
}

if (enabled[OAUTH_PROVIDERS.GITHUB]) {
  router.get(
    "/github",
    isGuest,
    authLimiter,
    passport.authenticate(OAUTH_PROVIDERS.GITHUB, {
      scope: PROVIDER_DEFINITIONS[OAUTH_PROVIDERS.GITHUB].scope,
      session: true,
    }),
  );

  router.get("/github/callback", githubCallback);
}

export default router;
