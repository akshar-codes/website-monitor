import { performance } from "node:perf_hooks";
import { JSONPath } from "jsonpath-plus";
import Ajv from "ajv";

const ajvInstance = new Ajv({
  allErrors: true,
  strict: false,
  loadSchema: undefined, // Strictly disable external schema loading
});

// Cache compiled schemas by serialized string
const schemaCache = new Map();
const MAX_CACHE_SIZE = 100;

const getCompiledSchema = (schemaObj) => {
  const key = JSON.stringify(schemaObj);
  if (schemaCache.has(key)) {
    return schemaCache.get(key);
  }
  const validate = ajvInstance.compile(schemaObj);
  if (schemaCache.size >= MAX_CACHE_SIZE) {
    const firstKey = schemaCache.keys().next().value;
    schemaCache.delete(firstKey);
  }
  schemaCache.set(key, validate);
  return validate;
};

const safeTruncate = (val, maxLen = 200) => {
  if (val === null || val === undefined) return null;
  let str;
  if (typeof val === "object") {
    try {
      str = JSON.stringify(val);
    } catch {
      str = String(val);
    }
  } else {
    str = String(val);
  }
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
};

const getHeaderCaseInsensitive = (headers, targetHeader) => {
  if (!headers || !targetHeader) return undefined;
  const targetLower = targetHeader.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === targetLower) {
      return value;
    }
  }
  return undefined;
};

/**
 * Evaluates configured API assertions against a completed, bounded HTTP response.
 *
 * @param {Array} assertions - Array of assertion definitions
 * @param {Object} responseContext - Bounded response containing { httpStatus, responseTime, headers, body }
 * @returns {Object} { results, summary, allPassed, hasFailures, hasErrors }
 */
export const evaluateAssertions = (assertions = [], responseContext = {}) => {
  const startTime = performance.now();

  if (!Array.isArray(assertions) || assertions.length === 0) {
    return {
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: 0,
        durationMs: 0,
      },
      allPassed: true,
      hasFailures: false,
      hasErrors: false,
    };
  }

  const {
    httpStatus = null,
    responseTime = 0,
    headers = {},
    body = null,
  } = responseContext;

  // Lazily parsed JSON state
  let jsonParsed = false;
  let parsedJsonData = undefined;
  let jsonParseError = null;

  const getParsedJson = () => {
    if (jsonParsed) {
      if (jsonParseError) throw jsonParseError;
      return parsedJsonData;
    }
    jsonParsed = true;
    if (body == null || body === "") {
      jsonParseError = new Error("Response body is empty; expected valid JSON");
      throw jsonParseError;
    }
    try {
      parsedJsonData = JSON.parse(body);
      return parsedJsonData;
    } catch (err) {
      jsonParseError = new Error(
        `Response body is not valid JSON: ${err.message}`,
      );
      throw jsonParseError;
    }
  };

  const results = [];
  let passedCount = 0;
  let failedCount = 0;
  let errorCount = 0;

  for (const assertion of assertions) {
    const itemStart = performance.now();
    let passed = false;
    let outcome = "failed"; // "passed" | "failed" | "error"
    let message = null;
    let actualValue = null;
    const targetValue = assertion.targetValue ?? null;

    try {
      switch (assertion.type) {
        case "statusCode": {
          actualValue = httpStatus;
          const expectedStatus = Number(assertion.targetValue);
          if (assertion.comparison === "equals") {
            passed = httpStatus === expectedStatus;
            if (!passed) {
              message = `Status code was ${httpStatus}, expected ${expectedStatus}`;
            }
          } else if (assertion.comparison === "not_equals") {
            passed = httpStatus !== expectedStatus;
            if (!passed) {
              message = `Status code was ${httpStatus}, expected not ${expectedStatus}`;
            }
          } else {
            outcome = "error";
            message = `Unsupported comparison '${assertion.comparison}' for statusCode`;
            break;
          }
          outcome = passed ? "passed" : "failed";
          break;
        }

        case "responseTime": {
          actualValue = responseTime;
          const targetMs = Number(assertion.targetValue);
          if (assertion.comparison === "less_than") {
            passed = responseTime < targetMs;
            if (!passed) {
              message = `Response time ${responseTime.toFixed(1)}ms exceeded threshold < ${targetMs}ms`;
            }
          } else if (assertion.comparison === "less_than_or_equal") {
            passed = responseTime <= targetMs;
            if (!passed) {
              message = `Response time ${responseTime.toFixed(1)}ms exceeded threshold <= ${targetMs}ms`;
            }
          } else if (assertion.comparison === "greater_than") {
            passed = responseTime > targetMs;
            if (!passed) {
              message = `Response time ${responseTime.toFixed(1)}ms was not > ${targetMs}ms`;
            }
          } else {
            outcome = "error";
            message = `Unsupported comparison '${assertion.comparison}' for responseTime`;
            break;
          }
          outcome = passed ? "passed" : "failed";
          break;
        }

        case "header": {
          const rawHeader = getHeaderCaseInsensitive(
            headers,
            assertion.property,
          );
          actualValue = rawHeader ?? null;
          const comp = assertion.comparison;

          if (comp === "exists") {
            passed = rawHeader !== undefined && rawHeader !== null;
            if (!passed)
              message = `Header '${assertion.property}' does not exist`;
          } else if (comp === "not_exists") {
            passed = rawHeader === undefined || rawHeader === null;
            if (!passed)
              message = `Header '${assertion.property}' unexpectedly exists`;
          } else if (comp === "equals") {
            const expectedStr = String(assertion.targetValue ?? "");
            passed = String(rawHeader ?? "") === expectedStr;
            if (!passed) {
              message = `Header '${assertion.property}' was '${rawHeader}', expected '${expectedStr}'`;
            }
          } else if (comp === "not_equals") {
            const expectedStr = String(assertion.targetValue ?? "");
            passed = String(rawHeader ?? "") !== expectedStr;
            if (!passed) {
              message = `Header '${assertion.property}' equals '${expectedStr}'`;
            }
          } else if (comp === "contains") {
            const needle = String(assertion.targetValue ?? "");
            passed =
              typeof rawHeader === "string" && rawHeader.includes(needle);
            if (!passed) {
              message = `Header '${assertion.property}' does not contain '${needle}'`;
            }
          } else if (comp === "not_contains") {
            const needle = String(assertion.targetValue ?? "");
            passed =
              typeof rawHeader === "string" && !rawHeader.includes(needle);
            if (!passed) {
              message = `Header '${assertion.property}' unexpectedly contains '${needle}'`;
            }
          } else {
            outcome = "error";
            message = `Unsupported comparison '${comp}' for header`;
            break;
          }
          outcome = passed ? "passed" : "failed";
          break;
        }

        case "bodyText": {
          const bodyStr = typeof body === "string" ? body : "";
          actualValue = bodyStr;
          const needle = String(assertion.targetValue ?? "");
          const comp = assertion.comparison;

          if (comp === "contains") {
            passed = bodyStr.includes(needle);
            if (!passed)
              message = `Response body does not contain expected text`;
          } else if (comp === "not_contains") {
            passed = !bodyStr.includes(needle);
            if (!passed) message = `Response body contains forbidden text`;
          } else if (comp === "equals") {
            passed = bodyStr === needle;
            if (!passed) message = `Response body does not equal expected text`;
          } else if (comp === "not_equals") {
            passed = bodyStr !== needle;
            if (!passed) message = `Response body matches forbidden text`;
          } else if (comp === "starts_with") {
            passed = bodyStr.startsWith(needle);
            if (!passed)
              message = `Response body does not start with expected text`;
          } else if (comp === "ends_with") {
            passed = bodyStr.endsWith(needle);
            if (!passed)
              message = `Response body does not end with expected text`;
          } else {
            outcome = "error";
            message = `Unsupported comparison '${comp}' for bodyText`;
            break;
          }
          outcome = passed ? "passed" : "failed";
          break;
        }

        case "jsonPath": {
          let jsonDoc;
          try {
            jsonDoc = getParsedJson();
          } catch (parseErr) {
            outcome = "error";
            message = parseErr.message;
            break;
          }

          let pathResults;
          try {
            pathResults = JSONPath({
              path: assertion.property,
              json: jsonDoc,
              eval: false,
              preventEval: true,
            });
          } catch (pathErr) {
            outcome = "error";
            message = `JSONPath evaluation failed: ${pathErr.message}`;
            break;
          }

          const matchCount = Array.isArray(pathResults)
            ? pathResults.length
            : 0;
          const firstMatch = matchCount > 0 ? pathResults[0] : undefined;
          actualValue = matchCount > 1 ? pathResults : (firstMatch ?? null);
          const comp = assertion.comparison;

          if (comp === "exists") {
            passed = matchCount > 0;
            if (!passed)
              message = `JSONPath '${assertion.property}' did not match any values`;
          } else if (comp === "not_exists") {
            passed = matchCount === 0;
            if (!passed)
              message = `JSONPath '${assertion.property}' matched ${matchCount} values`;
          } else if (comp === "is_null") {
            passed = matchCount > 0 && firstMatch === null;
            if (!passed)
              message = `JSONPath '${assertion.property}' is not null`;
          } else if (comp === "is_not_null") {
            passed = matchCount > 0 && firstMatch !== null;
            if (!passed)
              message = `JSONPath '${assertion.property}' is null or missing`;
          } else if (comp === "is_empty") {
            if (matchCount === 0) {
              passed = false;
              message = `JSONPath '${assertion.property}' did not match any values`;
            } else if (
              typeof firstMatch === "string" ||
              Array.isArray(firstMatch)
            ) {
              passed = firstMatch.length === 0;
              if (!passed)
                message = `Value at '${assertion.property}' is not empty`;
            } else if (firstMatch && typeof firstMatch === "object") {
              passed = Object.keys(firstMatch).length === 0;
              if (!passed)
                message = `Object at '${assertion.property}' is not empty`;
            } else {
              passed = false;
              message = `Value at '${assertion.property}' cannot be checked for emptiness`;
            }
          } else if (comp === "is_not_empty") {
            if (matchCount === 0) {
              passed = false;
              message = `JSONPath '${assertion.property}' did not match any values`;
            } else if (
              typeof firstMatch === "string" ||
              Array.isArray(firstMatch)
            ) {
              passed = firstMatch.length > 0;
              if (!passed)
                message = `Value at '${assertion.property}' is empty`;
            } else if (firstMatch && typeof firstMatch === "object") {
              passed = Object.keys(firstMatch).length > 0;
              if (!passed)
                message = `Object at '${assertion.property}' is empty`;
            } else {
              passed = true;
            }
          } else if (comp === "is_string") {
            passed = matchCount > 0 && typeof firstMatch === "string";
            if (!passed)
              message = `Value at '${assertion.property}' is not a string`;
          } else if (comp === "is_number") {
            passed =
              matchCount > 0 &&
              typeof firstMatch === "number" &&
              !Number.isNaN(firstMatch);
            if (!passed)
              message = `Value at '${assertion.property}' is not a number`;
          } else if (comp === "is_boolean") {
            passed = matchCount > 0 && typeof firstMatch === "boolean";
            if (!passed)
              message = `Value at '${assertion.property}' is not a boolean`;
          } else if (comp === "is_array") {
            passed = matchCount > 0 && Array.isArray(firstMatch);
            if (!passed)
              message = `Value at '${assertion.property}' is not an array`;
          } else if (comp === "equals") {
            if (matchCount === 0) {
              passed = false;
              message = `JSONPath '${assertion.property}' did not match any values`;
            } else {
              const expectedVal = assertion.targetValue;
              if (typeof expectedVal === "number") {
                passed = Number(firstMatch) === expectedVal;
              } else if (typeof expectedVal === "boolean") {
                passed = Boolean(firstMatch) === expectedVal;
              } else if (expectedVal === null) {
                passed = firstMatch === null;
              } else {
                passed =
                  String(firstMatch) === String(expectedVal) ||
                  firstMatch === expectedVal;
              }
              if (!passed) {
                message = `Value at '${assertion.property}' was ${JSON.stringify(firstMatch)}, expected ${JSON.stringify(expectedVal)}`;
              }
            }
          } else if (comp === "not_equals") {
            if (matchCount === 0) {
              passed = true;
            } else {
              const expectedVal = assertion.targetValue;
              if (typeof expectedVal === "number") {
                passed = Number(firstMatch) !== expectedVal;
              } else if (typeof expectedVal === "boolean") {
                passed = Boolean(firstMatch) !== expectedVal;
              } else if (expectedVal === null) {
                passed = firstMatch !== null;
              } else {
                passed =
                  String(firstMatch) !== String(expectedVal) &&
                  firstMatch !== expectedVal;
              }
              if (!passed) {
                message = `Value at '${assertion.property}' unexpectedly equals ${JSON.stringify(expectedVal)}`;
              }
            }
          } else if (comp === "contains") {
            if (matchCount === 0) {
              passed = false;
              message = `JSONPath '${assertion.property}' did not match any values`;
            } else {
              const needle = String(assertion.targetValue ?? "");
              if (typeof firstMatch === "string") {
                passed = firstMatch.includes(needle);
              } else if (Array.isArray(firstMatch)) {
                passed = firstMatch.some(
                  (item) =>
                    item === assertion.targetValue || String(item) === needle,
                );
              } else {
                passed = false;
              }
              if (!passed) {
                message = `Value at '${assertion.property}' does not contain '${needle}'`;
              }
            }
          } else if (comp === "not_contains") {
            if (matchCount === 0) {
              passed = true;
            } else {
              const needle = String(assertion.targetValue ?? "");
              if (typeof firstMatch === "string") {
                passed = !firstMatch.includes(needle);
              } else if (Array.isArray(firstMatch)) {
                passed = !firstMatch.some(
                  (item) =>
                    item === assertion.targetValue || String(item) === needle,
                );
              } else {
                passed = true;
              }
              if (!passed) {
                message = `Value at '${assertion.property}' unexpectedly contains '${needle}'`;
              }
            }
          } else {
            outcome = "error";
            message = `Unsupported comparison '${comp}' for jsonPath`;
            break;
          }
          outcome = passed ? "passed" : "failed";
          break;
        }

        case "jsonSchema": {
          let jsonDoc;
          try {
            jsonDoc = getParsedJson();
          } catch (parseErr) {
            outcome = "failed";
            message = `Response body is not valid JSON: ${parseErr.message}`;
            break;
          }

          let schemaObj = assertion.targetValue;
          if (typeof schemaObj === "string") {
            try {
              schemaObj = JSON.parse(schemaObj);
            } catch (err) {
              outcome = "error";
              message = `Malformed JSON Schema definition: ${err.message}`;
              break;
            }
          }

          let validate;
          try {
            validate = getCompiledSchema(schemaObj);
          } catch (compileErr) {
            outcome = "error";
            message = `JSON Schema compilation error: ${compileErr.message}`;
            break;
          }

          passed = Boolean(validate(jsonDoc));
          if (!passed) {
            outcome = "failed";
            const errorsText = ajvInstance.errorsText(validate.errors, {
              dataVar: "body",
            });
            message = `JSON Schema validation failed: ${errorsText}`;
          } else {
            outcome = "passed";
          }
          actualValue = "<JSON Response>";
          break;
        }

        default: {
          outcome = "error";
          message = `Unknown assertion type '${assertion.type}'`;
          break;
        }
      }
    } catch (unexpectedErr) {
      outcome = "error";
      passed = false;
      message = `Assertion execution error: ${unexpectedErr.message}`;
    }

    const durationMs = Number((performance.now() - itemStart).toFixed(2));
    if (outcome === "passed") passedCount++;
    else if (outcome === "failed") failedCount++;
    else if (outcome === "error") errorCount++;

    results.push({
      assertionId: assertion.id || null,
      type: assertion.type,
      property: assertion.property || null,
      comparison: assertion.comparison,
      targetValue: safeTruncate(targetValue),
      actualValue: safeTruncate(actualValue),
      passed,
      outcome,
      message: message ? message.slice(0, 500) : null,
      durationMs,
    });
  }

  const totalDurationMs = Number((performance.now() - startTime).toFixed(2));

  return {
    results,
    summary: {
      total: assertions.length,
      passed: passedCount,
      failed: failedCount,
      errors: errorCount,
      durationMs: totalDurationMs,
    },
    allPassed: failedCount === 0 && errorCount === 0,
    hasFailures: failedCount > 0,
    hasErrors: errorCount > 0,
  };
};
