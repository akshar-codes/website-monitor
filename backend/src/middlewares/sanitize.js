import { sanitizePayload } from "../utils/sanitize.js";

/**
 * Sanitises req.body against NoSQL injection, prototype pollution, and XSS.
 */
const sanitizeRequest = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizePayload(req.body);
  }

  next();
};

export default sanitizeRequest;
