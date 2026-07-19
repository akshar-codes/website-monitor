/**
 * Extracts the backend's machine-readable error code (e.g.
 * "EMAIL_NOT_VERIFIED"), when present, so components can branch on the
 * specific failure reason rather than parsing the message string.
 */
export function getAuthErrorCode(err) {
  return err?.response?.data?.code || null;
}

/**
 * Map an axios error from an auth request to a user-facing message.
 * `context` is "login", "register", or "verify" and only affects the
 * generic fallback used when the server didn't supply its own message.
 */
export function mapAuthError(err, context = "login") {
  const status = err?.response?.status;
  const serverMessage = err?.response?.data?.message;
  const fieldErrors = err?.response?.data?.errors;
  const code = getAuthErrorCode(err);

  if (!err?.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }

  if (code === "EMAIL_NOT_VERIFIED") {
    return (
      serverMessage || "Please verify your email address before signing in."
    );
  }

  if (fieldErrors?.length) {
    return (
      fieldErrors[0].message ||
      serverMessage ||
      "Please check the highlighted fields."
    );
  }

  if (status === 401) {
    return context === "login"
      ? "Incorrect email or password."
      : serverMessage || "Authentication failed.";
  }

  if (status === 403) {
    return serverMessage || "You don't have permission to perform this action.";
  }

  if (status === 409) {
    return serverMessage || "An account with this email already exists.";
  }

  if (status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return (
    serverMessage ||
    (context === "login"
      ? "Unable to sign in. Please try again."
      : "Unable to create your account. Please try again.")
  );
}
