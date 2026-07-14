const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "confirmpassword",
  "currentpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "authorization",
  "auth",
  "secret",
  "apikey",
  "api_key",
  "clientsecret",
  "client_secret",
  "cookie",
  "cookies",
  "sessionid",
  "creditcard",
  "cardnumber",
  "cvv",
  "ssn",
  "privatekey",
  "private_key",
]);

const REDACTED = "[REDACTED]";

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof Error);

export const redact = (input, seen = new WeakSet()) => {
  if (Array.isArray(input)) {
    return input.map((item) => redact(item, seen));
  }

  if (isPlainObject(input)) {
    if (seen.has(input)) return "[CIRCULAR]";
    seen.add(input);

    return Object.entries(input).reduce((acc, [key, value]) => {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        acc[key] = REDACTED;
      } else if (isPlainObject(value) || Array.isArray(value)) {
        acc[key] = redact(value, seen);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
  }

  return input;
};

/**
 * Masks credentials embedded in a MongoDB connection string.
 * mongodb://user:pass@host/db  →  mongodb://***:***@host/db
 */
export const maskConnectionString = (uri) => {
  if (!uri) return uri;
  try {
    return uri.replace(/\/\/([^:/@]+):([^@]+)@/, "//***:***@");
  } catch {
    return "[REDACTED_URI]";
  }
};

/**
 * Redacts sensitive HTTP headers before logging.
 */
export const redactHeaders = (headers = {}) => {
  const clone = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    clone[key] = [
      "authorization",
      "cookie",
      "set-cookie",
      "x-api-key",
    ].includes(lower)
      ? REDACTED
      : value;
  }
  return clone;
};

/**
 * Strips sensitive query-string parameter values from a URL before
 * logging (e.g. ?token=... or ?apiKey=...). Leaves the URL unchanged
 * if it carries no sensitive params.
 */
export const sanitizeUrl = (url = "") => {
  const [pathPart, queryPart] = url.split("?");
  if (!queryPart) return url;

  const params = new URLSearchParams(queryPart);
  let changed = false;

  for (const key of params.keys()) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      params.set(key, REDACTED);
      changed = true;
    }
  }

  return changed ? `${pathPart}?${params.toString()}` : url;
};
