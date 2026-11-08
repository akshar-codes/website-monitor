import { z } from "zod";
import normalizeUrl from "../utils/normalizeUrl.js";
import { INTERVAL_PRESETS, MONITOR_SORT_FIELDS } from "../config/constants.js";

// ── Shared field definitions ──

const nameField = z
  .string({ required_error: "Name is required" })
  .trim()
  .min(1, "Name cannot be empty")
  .max(120, "Name cannot exceed 120 characters");

const urlField = z
  .string({ required_error: "URL is required" })
  .trim()
  .refine(
    (v) => {
      try {
        const parsed = new URL(v);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: "Must be a valid HTTP or HTTPS URL" },
  )
  // Normalise after validation so storage is canonical
  .transform((v) => normalizeUrl(v));

const QUERY_LIMIT = 30;
const HEADER_LIMIT = 30;
const BODY_LIMIT = 64 * 1024;
const reservedHeaders = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "expect",
  "cookie",
  "set-cookie",
  "authorization",
]);
const apiQueryField = z
  .record(z.string().min(1).max(128), z.string().max(2048))
  .refine(
    (value) => Object.keys(value).length <= QUERY_LIMIT,
    `At most ${QUERY_LIMIT} query parameters are allowed`,
  );
const apiHeadersField = z
  .record(
    z.string().min(1).max(128),
    z
      .string()
      .max(2048)
      .refine(
        (value) => !/[\r\n]/.test(value),
        "Header values cannot contain CR or LF",
      ),
  )
  .refine(
    (value) => Object.keys(value).length <= HEADER_LIMIT,
    `At most ${HEADER_LIMIT} headers are allowed`,
  )
  .refine(
    (value) =>
      Object.keys(value).every(
        (name) =>
          /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) &&
          !reservedHeaders.has(name.toLowerCase()),
      ),
    "Header name is invalid or reserved",
  )
  .refine(
    (value) =>
      new Set(Object.keys(value).map((name) => name.toLowerCase())).size ===
      Object.keys(value).length,
    "Header names must be unique regardless of case",
  );
const authCreate = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }).strict(),
  z
    .object({ mode: z.literal("bearer"), token: z.string().min(1).max(4096) })
    .strict(),
  z
    .object({
      mode: z.literal("basic"),
      username: z.string().min(1).max(256),
      password: z.string().min(1).max(4096),
    })
    .strict(),
]);
const apiConfigBase = z
  .object({
    version: z.literal(1).optional().default(1),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    queryParams: apiQueryField.optional().default({}),
    headers: apiHeadersField.optional().default({}),
    body: z
      .string()
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= BODY_LIMIT,
        `Request body cannot exceed ${BODY_LIMIT} bytes`,
      )
      .optional()
      .nullable(),
    authentication: authCreate.optional().default({ mode: "none" }),
    expectedStatusCodes: z
      .array(z.number().int().min(100).max(599))
      .min(1)
      .max(20)
      .optional()
      .default([200]),
    maxResponseTimeMs: z
      .number()
      .int()
      .min(1)
      .max(120000)
      .optional()
      .default(10000),
  })
  .strict();
const validateApiConfig = (config, ctx) => {
  if (config.body && ["GET", "DELETE"].includes(config.method))
    ctx.addIssue({
      code: "custom",
      path: ["body"],
      message: `${config.method} requests cannot include a body`,
    });
  if (
    new Set(config.expectedStatusCodes).size !==
    config.expectedStatusCodes.length
  )
    ctx.addIssue({
      code: "custom",
      path: ["expectedStatusCodes"],
      message: "Expected status codes must be unique",
    });
};
const apiConfigCreate = apiConfigBase.superRefine(validateApiConfig);
const apiConfigUpdate = apiConfigBase
  .extend({
    queryParams: apiQueryField.optional(),
    headers: apiHeadersField.optional(),
    authentication: z
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("none") }).strict(),
        z
          .object({
            mode: z.literal("bearer"),
            token: z.string().min(1).max(4096).optional(),
          })
          .strict(),
        z
          .object({
            mode: z.literal("basic"),
            username: z.string().min(1).max(256).optional(),
            password: z.string().min(1).max(4096).optional(),
          })
          .strict(),
      ])
      .optional(),
  })
  .strict()
  .superRefine(validateApiConfig);

const intervalField = z
  .number({ required_error: "Interval is required" })
  .int("Interval must be a whole number")
  .min(30, "Interval must be at least 30 seconds")
  .refine((v) => INTERVAL_PRESETS.includes(v), {
    message: `Interval must be one of: ${INTERVAL_PRESETS.join(", ")} (seconds)`,
  });

const activeField = z.boolean();
const performanceAlertsField = z
  .object({
    enabled: z.boolean().optional(),
    sensitivity: z.enum(["low", "normal", "high"]).optional(),
    thresholdMultiplier: z.number().min(1.1).max(5).optional(),
    consecutiveBreaches: z.number().int().min(2).max(10).optional(),
    cooldownMinutes: z.number().int().min(5).max(1440).optional(),
  })
  .strict();
const regionalMonitoringField = z
  .object({
    enabled: z.boolean(),
    regions: z
      .array(z.enum(["india-mumbai", "us-east", "eu-west", "singapore"]))
      .max(4)
      .refine(
        (regions) => new Set(regions).size === regions.length,
        "Regions must be unique",
      ),
  })
  .strict();

// ── Create schema — all required fields ──

export const createMonitorSchema = z
  .object({
    name: nameField,
    url: urlField,
    kind: z.enum(["website", "api"]).optional(),
    apiConfig: apiConfigCreate.optional(),
    // Existing website forms submit this ignored field; retain that wire
    // compatibility until their later API-monitor form update.
    method: z.enum(["GET", "HEAD", "POST"]).optional(),
    interval: intervalField.optional().default(300),
    active: activeField.optional().default(true),
    regionalMonitoring: regionalMonitoringField.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === "api" && !data.apiConfig)
      ctx.addIssue({
        code: "custom",
        path: ["apiConfig"],
        message: "API configuration is required for API monitors",
      });
    if (data.kind !== "api" && data.apiConfig)
      ctx.addIssue({
        code: "custom",
        path: ["apiConfig"],
        message: "API configuration is only valid for API monitors",
      });
    if (data.kind === "api" && data.method !== undefined)
      ctx.addIssue({
        code: "custom",
        path: ["method"],
        message: "Configure the HTTP method inside apiConfig",
      });
    if (data.kind === "api") {
      if (data.url.length > 2048)
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message: "API URL cannot exceed 2048 characters",
        });
      try {
        const parsed = new URL(data.url);
        if (parsed.username || parsed.password)
          ctx.addIssue({
            code: "custom",
            path: ["url"],
            message: "API URL must not contain embedded credentials",
          });
        if (parsed.search || parsed.hash)
          ctx.addIssue({
            code: "custom",
            path: ["url"],
            message:
              "Place API query parameters in apiConfig.queryParams; API URLs cannot contain a query or fragment",
          });
      } catch {
        // The base URL validator reports malformed or unsupported URLs.
      }
    }
  });

// ── Update schema — all fields optional, at least one required ──

export const updateMonitorSchema = z
  .object({
    name: nameField.optional(),
    url: urlField.optional(),
    kind: z.enum(["website", "api"]).optional(),
    apiConfig: apiConfigUpdate.optional(),
    // Compatibility with the existing website edit form, where this value
    // has historically been accepted but not persisted or executed.
    method: z.enum(["GET", "HEAD", "POST"]).optional(),
    interval: intervalField.optional(),
    active: activeField.optional(),
    performanceAlerts: performanceAlertsField.optional(),
    regionalMonitoring: regionalMonitoringField.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === "api" && data.url && data.url.length > 2048)
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "API URL cannot exceed 2048 characters",
      });
    if (data.kind === "api" && data.method !== undefined)
      ctx.addIssue({
        code: "custom",
        path: ["method"],
        message: "Configure the HTTP method inside apiConfig",
      });
    if (Object.keys(data).length === 0)
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided for update",
      });
  });

// ── Query params for listing ──

export const listMonitorsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  sortBy: z.enum(MONITOR_SORT_FIELDS).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});
