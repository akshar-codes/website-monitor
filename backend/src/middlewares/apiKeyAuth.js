import ApiError from "../utils/ApiError.js";
import {
  authenticateApiKeySecret,
  recordApiKeyUse,
} from "../services/apiKey.service.js";

export const requireApiKey = async (req, _res, next) => {
  try {
    const auth = req.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const result = await authenticateApiKeySecret(token);
    if (!result)
      return next(ApiError.unauthorized("A valid API key is required"));
    req.user = result.user;
    req.apiKey = result.key;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const recordApiKeyUsage = async (req, _res, next) => {
  try {
    await recordApiKeyUse(req.apiKey._id);
    return next();
  } catch (error) {
    return next(error);
  }
};
