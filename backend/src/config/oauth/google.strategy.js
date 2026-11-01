import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import {
  PROVIDER_DEFINITIONS,
  isProviderConfigured,
} from "./providers.config.js";
import { OAUTH_PROVIDERS } from "../constants.js";
import { findOrCreateOAuthUser } from "../../services/oauth.service.js";
import logger from "../../utils/logger.js";

const buildGoogleStrategy = () => {
  const def = PROVIDER_DEFINITIONS[OAUTH_PROVIDERS.GOOGLE];

  return new GoogleStrategy(
    {
      clientID: def.clientID,
      clientSecret: def.clientSecret,
      callbackURL: def.callbackURL,
      state: true,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const primaryEmail = profile.emails?.[0] || null;
        // Trust only an explicit verified-email claim. Passport's normalized
        // email entry may omit this flag, while Google's raw profile exposes
        // `email_verified`.
        const emailVerifiedByProvider =
          primaryEmail?.verified ?? profile._json?.email_verified === true;

        const user = await findOrCreateOAuthUser({
          provider: OAUTH_PROVIDERS.GOOGLE,
          providerId: profile.id,
          email: primaryEmail?.value || null,
          name: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value || null,
          emailVerifiedByProvider,
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  );
};

export const registerGoogleStrategy = (passport) => {
  if (!isProviderConfigured(OAUTH_PROVIDERS.GOOGLE)) {
    logger.warn(
      "Google OAuth is not configured (missing client ID/secret/callback URL) — skipping strategy registration",
    );
    return;
  }

  passport.use(OAUTH_PROVIDERS.GOOGLE, buildGoogleStrategy());
  logger.info("Google OAuth strategy registered");
};
