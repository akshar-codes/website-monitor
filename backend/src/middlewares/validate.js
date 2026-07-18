import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { sanitizeQueryTarget } from "../utils/sanitize.js";

const formatZodErrors = (zodError, fallbackField) =>
  zodError.errors.map((issue) => ({
    field: issue.path.length ? issue.path.join(".") : fallbackField,
    message: issue.message,
  }));

export const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const target =
      source === "query" ? sanitizeQueryTarget(req.query) : req[source];

    const result = schema.safeParse(target);

    if (!result.success) {
      return next(ApiError.validation(formatZodErrors(result.error, source)));
    }

    if (source === "query") {
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }

    return next();
  };

export const validateObjectId =
  (paramName = "id") =>
  (req, res, next) => {
    const value = req.params[paramName];

    if (!mongoose.Types.ObjectId.isValid(value)) {
      return next(
        ApiError.validation([
          { field: paramName, message: `Invalid ID format: ${value}` },
        ]),
      );
    }

    return next();
  };

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export const validateSessionIdParam =
  (paramName = "sessionId") =>
  (req, res, next) => {
    const value = req.params[paramName];

    if (!SESSION_ID_PATTERN.test(value || "")) {
      return next(
        ApiError.validation([
          { field: paramName, message: "Invalid session ID format" },
        ]),
      );
    }

    return next();
  };
