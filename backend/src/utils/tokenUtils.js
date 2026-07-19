import crypto from "crypto";

/**
 * Generates a cryptographically secure token pair for one-time actions
 */
export const generateSecureToken = (byteLength = 32) => {
  const token = crypto.randomBytes(byteLength).toString("hex");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
};

/**
 * SHA-256 hash of a raw token — used both when issuing a new token and
 * when verifying one submitted by a client.
 */
export const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");
