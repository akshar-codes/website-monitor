/**
 * Maps the backend's machine-readable access-control error codes (see
 * backend/src/utils/ApiError.js — upgradeRequired / featureRestricted /
 * the generalized forbidden(message, code) used by authorize.js,
 * permission.js, and ownership.js) to client-side helpers, mirroring the
 * pattern already used for auth errors in utils/AuthErrors.js.
 */
export const ACCESS_ERROR_CODES = Object.freeze({
  UPGRADE_REQUIRED: "UPGRADE_REQUIRED",
  FEATURE_RESTRICTED: "FEATURE_RESTRICTED",
  ROLE_FORBIDDEN: "ROLE_FORBIDDEN",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  OWNERSHIP_REQUIRED: "OWNERSHIP_REQUIRED",
});

export function getAccessErrorCode(err) {
  return err?.response?.data?.code || null;
}

export function isUpgradeRequiredError(err) {
  return getAccessErrorCode(err) === ACCESS_ERROR_CODES.UPGRADE_REQUIRED;
}

export function isFeatureRestrictedError(err) {
  return getAccessErrorCode(err) === ACCESS_ERROR_CODES.FEATURE_RESTRICTED;
}

/** Blocked by role (see backend middlewares/authorize.js). */
export function isRoleForbiddenError(err) {
  return getAccessErrorCode(err) === ACCESS_ERROR_CODES.ROLE_FORBIDDEN;
}

/** Blocked by a missing permission (see backend middlewares/permission.js). */
export function isPermissionDeniedError(err) {
  return getAccessErrorCode(err) === ACCESS_ERROR_CODES.PERMISSION_DENIED;
}

/** Blocked because the resource isn't owned by the caller. */
export function isOwnershipRequiredError(err) {
  return getAccessErrorCode(err) === ACCESS_ERROR_CODES.OWNERSHIP_REQUIRED;
}

/** True for ANY of the access-control codes above — role, permission,
 * ownership, plan tier, or plan feature. */
export function isAccessError(err) {
  const code = getAccessErrorCode(err);
  return !!code && Object.values(ACCESS_ERROR_CODES).includes(code);
}

/**
 * Extracts a user-facing message for an access-control error, falling
 * back to a generic message when the server didn't supply one.
 */
export function getAccessErrorMessage(err) {
  return (
    err?.response?.data?.message ||
    "This action isn't available to your account."
  );
}
