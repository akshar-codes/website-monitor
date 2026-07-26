import ApiError from "../utils/ApiError.js";

/**
 * Guards routes that require an authenticated session.
 * `req.isAuthenticated()` is added to the request object by Passport's
 * session middleware.
 *
 * Also rejects sessions belonging to a suspended account (`active ===
 * false`). This is defense-in-depth: suspending a user (see
 * services/admin.service.js#suspendUser) already destroys every session
 * the account holds, so a normal suspension is caught the moment the
 * session cookie stops resolving to anything. This check additionally
 * covers the edge case of a request already in flight the instant the
 * suspension happens, and fails closed rather than trusting session
 * destruction as the only enforcement point.
 */
export const isAuthenticated = (req, _res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.user && req.user.active === false) {
      return next(
        ApiError.unauthorized(
          "Your account has been suspended. Please contact support.",
        ),
      );
    }
    return next();
  }
  return next(ApiError.unauthorized("Please log in to continue"));
};

/**
 * Guards routes that should only be reachable while logged out.
 * Not currently mounted on any route (the frontend already redirects
 * authenticated users away from /login and /register via GuestRoute),
 * kept here as the server-side equivalent for defense in depth.
 */
export const isGuest = (req, _res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next(ApiError.badRequest("You are already logged in"));
  }
  return next();
};
