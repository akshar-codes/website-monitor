import env from "./env.js";

/**
 * Helmet configuration. Everything not listed below uses Helmet's secure
 * defaults (frameguard, noSniff, hidePoweredBy, referrerPolicy, etc.).
 */
const helmetOptions = {
  // This is a pure JSON API — no HTML or inline scripts are ever served —

  contentSecurityPolicy: false,

  // HSTS only makes sense once the API is actually served over HTTPS, which
  hsts: env.isProd
    ? { maxAge: 63072000, includeSubDomains: true, preload: true }
    : false,
};

export default helmetOptions;
