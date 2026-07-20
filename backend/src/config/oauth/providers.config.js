import env from "../env.js";
import { OAUTH_PROVIDERS } from "../constants.js";

/**
 * Single source of truth mapping each supported provider to the env vars
 * that configure it. To add a new provider (Facebook, Microsoft, Discord,
 * ...):
 *   1. Add its key to OAUTH_PROVIDERS in config/constants.js
 *   2. Add its client ID / secret / callback URL to config/env.js
 *   3. Add an entry here
 *   4. Add a `<provider>.strategy.js` file next to this one and register
 *      it in oauth/index.js
 * Nothing else in the auth stack (service, controller, routes, model)
 * needs to change.
 */
export const PROVIDER_DEFINITIONS = Object.freeze({
  [OAUTH_PROVIDERS.GOOGLE]: {
    name: OAUTH_PROVIDERS.GOOGLE,
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: env.GOOGLE_CALLBACK_URL,
    scope: ["profile", "email"],
  },
  [OAUTH_PROVIDERS.GITHUB]: {
    name: OAUTH_PROVIDERS.GITHUB,
    clientID: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    callbackURL: env.GITHUB_CALLBACK_URL,
    scope: ["user:email"],
  },
});

/**
 * A provider is considered "configured" only when every credential it
 * needs is present. Strategies are registered — and their routes mounted —
 * only for configured providers, so an incomplete/missing config silently
 * disables that provider instead of crashing the server at startup.
 */
export const isProviderConfigured = (provider) => {
  const def = PROVIDER_DEFINITIONS[provider];
  return !!(def && def.clientID && def.clientSecret && def.callbackURL);
};

/** `{ google: true, github: false, ... }` — used by routes to conditionally mount. */
export const getEnabledProviders = () =>
  Object.fromEntries(
    Object.keys(PROVIDER_DEFINITIONS).map((key) => [
      key,
      isProviderConfigured(key),
    ]),
  );
