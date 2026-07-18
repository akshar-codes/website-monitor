import env from "../config/env.js";

export const applySessionPersistence = (req, { rememberMe = false } = {}) => {
  req.session.cookie.maxAge = rememberMe
    ? env.SESSION_REMEMBER_ME_MAX_AGE_MS
    : env.SESSION_DEFAULT_MAX_AGE_MS;

  req.session.deviceInfo = {
    userAgent: req.headers["user-agent"] || "unknown",
    ip: req.ip,
    loginAt: new Date(),
  };
};
