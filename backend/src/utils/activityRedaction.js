const SECRET_KEY_PATTERN = /(password|token|secret|cookie|authorization|api[-_]?key|session.?id|oauth|credential|^ip$|user.?agent|fingerprint)/i;

export const redactActivityText = (value) => String(value)
  .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
  .replace(/([?&](?:access_?token|refresh_?token|token|api_?key|secret|password)=)[^&#\s]*/gi, "$1[REDACTED]")
  .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1[REDACTED]@")
  .replace(/((?:api[-_]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");

export const sanitizeActivityMetadata = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeActivityMetadata);
  if (value instanceof Date || (value && typeof value.toHexString === "function")) return value;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_KEY_PATTERN.test(key)).map(([key, item]) => [key, sanitizeActivityMetadata(item)]));
  if (typeof value === "string") return redactActivityText(value);
  return value;
};
