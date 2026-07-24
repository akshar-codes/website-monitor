/**
 * Maps the backend's machine-readable access-control error codes (see
 * backend/src/utils/ApiError.js#upgradeRequired / #featureRestricted) to
 * client-side helpers, mirroring the pattern already used for auth errors
 * in constants/AuthErrors.js.
 */
export const ACCESS_ERROR_CODES = Object.freeze({
  UPGRADE_REQUIRED: "UPGRADE_REQUIRED",
  FEATURE_RESTRICTED: "FEATURE_RESTRICTED",
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

export function isAccessError(err) {
  return isUpgradeRequiredError(err) || isFeatureRestrictedError(err);
}

/**
 * Extracts a user-facing message for an access-control error, falling
 * back to a generic message when the server didn't supply one.
 */
export function getAccessErrorMessage(err) {
  return (
    err?.response?.data?.message ||
    "This action isn't available on your current plan."
  );
}
