/**
 * Map an axios error from an auth request to a user-facing message.
 * `context` is "login" or "register" and only affects the generic fallback.
 */
export function mapAuthError(err, context = "login") {
  const status = err?.response?.status;
  const serverMessage = err?.response?.data?.message;
  const fieldErrors = err?.response?.data?.errors;

  if (!err?.response) {
    return "Unable to reach the server. Check your connection and try again.";
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
