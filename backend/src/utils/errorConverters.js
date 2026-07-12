import ApiError from "./ApiError.js";

// ── MongoDB / Mongoose ────────────────────────────────────────────────────────

/**
 * Mongoose CastError — thrown when a value can't be cast to the schema type
 * (most commonly an invalid ObjectId reaching a query).
 */
export const handleCastErrorDB = (err) => {
  const message = `Invalid value for field "${err.path}": ${err.value}`;
  return ApiError.badRequest(message, [
    { field: err.path, message: `Invalid ${err.kind || "value"}` },
  ]);
};

/**
 * MongoDB duplicate-key error (E11000) — raised by the driver, not Mongoose,
 * so it has no `.name` of "ValidationError"; identified by `err.code`.
 */
export const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0];
  const value = field ? err.keyValue[field] : undefined;

  const message = field
    ? `"${value}" is already in use for field "${field}"`
    : "Duplicate value violates a unique constraint";

  return ApiError.conflict(
    message,
    field ? [{ field, message: `"${value}" already exists` }] : null,
  );
};

/**
 * Mongoose ValidationError — thrown by schema-level `validate` functions,
 * `required`, `enum`, `min`/`max`, etc. on `.save()` / `.create()`.
 */
export const handleValidationErrorDB = (err) => {
  const details = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  const message = details.map((d) => d.message).join("; ");
  return ApiError.badRequest(message, details);
};

// ── Zod ────────────────────────────────────────────────────────────────────────

export const handleZodError = (err) => {
  const issues = err.errors || err.issues || [];
  const details = issues.map((e) => ({
    field: Array.isArray(e.path) ? e.path.join(".") : undefined,
    message: e.message,
  }));
  const message =
    details.map((d) => d.message).join("; ") || "Validation failed";
  return ApiError.badRequest(message, details);
};

// ── JWT / Authentication (jsonwebtoken) ─────────────────────────────────────────

export const handleJWTError = () =>
  ApiError.unauthorized("Invalid authentication token. Please log in again.");

export const handleJWTExpiredError = () =>
  ApiError.unauthorized("Your session has expired. Please log in again.");

export const handleJWTNotBeforeError = () =>
  ApiError.unauthorized("Authentication token is not yet valid.");
