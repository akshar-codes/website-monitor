import env from "../config/env.js";

/**
 * Builds the URL the browser is redirected to once an OAuth attempt
 * finishes (success or failure). The frontend's OAuthCallback page reads
 * these query params to decide what to render — see
 * frontend/src/pages/OAuthCallback.jsx.
 */
export const buildOAuthRedirectUrl = ({ status, code, message, email } = {}) => {
  const url = new URL(env.OAUTH_CALLBACK_PATH, env.CLIENT_URL);

  if (status) url.searchParams.set("status", status);
  if (code) url.searchParams.set("code", code);
  if (message) url.searchParams.set("message", message);
  if (email) url.searchParams.set("email", email);

  return url.toString();
};
