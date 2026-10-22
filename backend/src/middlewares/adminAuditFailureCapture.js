import { recordFailedAdminOperation } from "../services/adminAudit.service.js";

/** Log failed writes only; successful operations are logged in their services. */
export const captureFailedAdminOperations = (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.once("finish", () => {
      if (res.statusCode >= 400) {
        recordFailedAdminOperation({
          admin: req.user,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        });
      }
    });
  }
  next();
};
