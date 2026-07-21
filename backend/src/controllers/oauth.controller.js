import passport from "../config/passport.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { applySessionPersistence } from "../utils/sessionMeta.js";
import { buildOAuthRedirectUrl } from "../utils/oauthRedirect.js";
import { OAUTH_PROVIDERS } from "../config/constants.js";

const GENERIC_FAILURE_MESSAGE =
  "We couldn't complete sign-in with this provider. Please try again or use a different method.";

/**
 * Builds the callback route handler for a given provider. This is the one
 * place that turns a Passport OAuth result into a session + redirect, so
 * every provider (Google, GitHub, and any future addition) behaves
 * identically — the only thing that varies between providers is the
 * Passport strategy name itself.
 *
 * The `passport.authenticate` verify callback below is async (it persists
 * login-activity fields before establishing the session), so it's wrapped
 * in its own try/catch that forwards to `next()` — `asyncHandler` only
 * covers the outer synchronous call to `passport.authenticate(...)(req, res, next)`,
 * not this inner callback, which Passport invokes later on its own.
 */
const createOAuthCallbackHandler = (providerName) =>
  asyncHandler((req, res, next) => {
    passport.authenticate(providerName, async (err, user, info) => {
      try {
        if (err) {
          // Operational ApiErrors (e.g. the "account already exists, sign in
          // with your password" conflict) carry a message that's safe to
          // show the user; anything else is logged and replaced with a
          // generic message so internals never leak into a redirect URL.
          const isSafeMessage = err instanceof ApiError && err.isOperational;

          logger.error(`${providerName} OAuth error: ${err.message}`, {
            stack: err.stack,
          });

          return res.redirect(
            buildOAuthRedirectUrl({
              status: "error",
              message: isSafeMessage ? err.message : GENERIC_FAILURE_MESSAGE,
            }),
          );
        }

        if (!user) {
          return res.redirect(
            buildOAuthRedirectUrl({
              status: "error",
              message: info?.message || GENERIC_FAILURE_MESSAGE,
            }),
          );
        }

        // Mirrors the local-login rule: an account whose email hasn't been
        // confirmed (provider didn't verify it, so we issued our own
        // verification email — see services/oauth.service.js) cannot start a
        // session yet.
        if (!user.emailVerified) {
          return res.redirect(
            buildOAuthRedirectUrl({
              status: "error",
              code: "EMAIL_NOT_VERIFIED",
              message:
                "Please verify your email address before signing in. Check your inbox for a verification link.",
              email: user.email,
            }),
          );
        }

        // Login-activity tracking — mirrors what the Local strategy records
        // via services/auth.service.js#validateCredentials, so "last seen"
        // data is consistent regardless of authentication method.
        user.recordLogin(req.ip);
        await user.save({ validateBeforeSave: false });

        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);

          // OAuth has no "remember me" checkbox — default to the longer
          // session lifetime for a smoother social-login experience.
          applySessionPersistence(req, { rememberMe: true });

          req.session.save((saveErr) => {
            if (saveErr) return next(saveErr);

            logger.info(
              `${providerName} OAuth login succeeded for user ${user._id} (${user.email}) from ${req.ip}`,
            );

            return res.redirect(buildOAuthRedirectUrl({ status: "success" }));
          });
        });
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  });

export const googleCallback = createOAuthCallbackHandler(OAUTH_PROVIDERS.GOOGLE);
export const githubCallback = createOAuthCallbackHandler(OAUTH_PROVIDERS.GITHUB);
