import ApiError from "../utils/ApiError.js";

/**
 * Guards routes that require an authenticated session.
 * `req.isAuthenticated()` is added to the request object by Passport's
 * session middleware.
 */
export const isAuthenticated = (req, _res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
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
