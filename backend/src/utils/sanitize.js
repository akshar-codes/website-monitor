import xss from "xss";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date);

/**
 * Recursively strips MongoDB operator keys (leading "$"), dotted keys (used)
 */
export const mongoSanitizeValue = (input) => {
  if (Array.isArray(input)) {
    return input.map(mongoSanitizeValue);
  }

  if (isPlainObject(input)) {
    return Object.entries(input).reduce((acc, [key, value]) => {
      if (key.startsWith("$") || key.includes(".") || DANGEROUS_KEYS.has(key)) {
        return acc; // drop the key entirely — don't try to "fix" it
      }
      acc[key] = mongoSanitizeValue(value);
      return acc;
    }, {});
  }

  return input;
};

/**
 * Recursively escapes/strips dangerous HTML and script content from every
 * string in a payload. Non-string primitives pass through untouched.
 */
export const xssSanitizeValue = (input) => {
  if (typeof input === "string") {
    return xss(input);
  }

  if (Array.isArray(input)) {
    return input.map(xssSanitizeValue);
  }

  if (isPlainObject(input)) {
    return Object.entries(input).reduce((acc, [key, value]) => {
      acc[key] = xssSanitizeValue(value);
      return acc;
    }, {});
  }

  return input;
};

/**
 * HTTP Parameter Pollution guard — collapses duplicate query keys
 */
export const collapseArrayDuplicates = (input) => {
  if (!isPlainObject(input)) return input;

  return Object.entries(input).reduce((acc, [key, value]) => {
    acc[key] = Array.isArray(value) ? value[value.length - 1] : value;
    return acc;
  }, {});
};

/** Full pipeline (HPP → Mongo → XSS) used for query-string input. */
export const sanitizeQueryTarget = (input) =>
  xssSanitizeValue(mongoSanitizeValue(collapseArrayDuplicates(input)));

/** Mongo + XSS pipeline used for req.body, where HPP collapsing doesn't apply. */
export const sanitizePayload = (input) =>
  xssSanitizeValue(mongoSanitizeValue(input));
