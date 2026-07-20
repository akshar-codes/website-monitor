import { Strategy as GitHubStrategy } from "passport-github2";
import { PROVIDER_DEFINITIONS, isProviderConfigured } from "./providers.config.js";
import { OAUTH_PROVIDERS } from "../constants.js";
import { findOrCreateOAuthUser } from "../../services/oauth.service.js";
import logger from "../../utils/logger.js";

const buildGitHubStrategy = () => {
  const def = PROVIDER_DEFINITIONS[OAUTH_PROVIDERS.GITHUB];

  return new GitHubStrategy(
    {
      clientID: def.clientID,
      clientSecret: def.clientSecret,
      callbackURL: def.callbackURL,
      scope: def.scope,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        // With the `user:email` scope, passport-github2 fetches
        // /user/emails and populates profile.emails with every address the
        // account has, each flagged with { primary, verified }. GitHub does
        // NOT guarantee the primary address is verified, unlike Google —
        // so this is checked explicitly rather than assumed.
        const emails = profile.emails || [];
        const primaryEmail = emails.find((e) => e.primary) || emails[0] || null;
        const emailVerifiedByProvider = primaryEmail?.verified === true;

        const user = await findOrCreateOAuthUser({
          provider: OAUTH_PROVIDERS.GITHUB,
          providerId: String(profile.id),
          email: primaryEmail?.value || null,
          name: profile.displayName || profile.username || null,
          avatarUrl:
            profile.photos?.[0]?.value || profile._json?.avatar_url || null,
          emailVerifiedByProvider,
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  );
};

export const registerGitHubStrategy = (passport) => {
  if (!isProviderConfigured(OAUTH_PROVIDERS.GITHUB)) {
    logger.warn(
      "GitHub OAuth is not configured (missing client ID/secret/callback URL) — skipping strategy registration",
    );
    return;
  }

  passport.use(OAUTH_PROVIDERS.GITHUB, buildGitHubStrategy());
  logger.info("GitHub OAuth strategy registered");
};
