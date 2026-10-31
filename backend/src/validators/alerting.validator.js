import { z } from "zod";

export const ALERT_EVENTS = Object.freeze([
  "monitor.down",
  "monitor.recovered",
  "monitor.degraded",
  "incident.created",
  "incident.updated",
  "incident.resolved",
  "ssl.expiring",
  "domain.expiring",
  "monitor.ssl_error",
]);

const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      return (
        new URL(value).protocol === "https:" &&
        !new URL(value).username &&
        !new URL(value).password
      );
    } catch {
      return false;
    }
  }, "A valid HTTPS URL is required");
const customHeaders = z
  .record(
    z.string().regex(/^x-[a-z0-9-]{1,60}$/i),
    z
      .string()
      .max(1000)
      .refine(
        (value) => !/[\r\n]/.test(value),
        "Header values cannot contain line breaks",
      ),
  )
  .optional()
  .superRefine((headers, ctx) => {
    if (!headers) return;
    const entries = Object.entries(headers);
    if (entries.length > 10)
      ctx.addIssue({
        code: "custom",
        message: "At most 10 custom headers are allowed",
      });
    if (entries.some(([name]) => name.toLowerCase().startsWith("x-sitewatch-")))
      ctx.addIssue({
        code: "custom",
        message: "X-SiteWatch headers are reserved",
      });
  });

export const integrationCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    provider: z.enum(["slack", "discord", "telegram", "webhook"]),
    webhookUrl: httpsUrl.optional(),
    endpointUrl: httpsUrl.optional(),
    botToken: z.string().min(25).max(200).optional(),
    chatId: z.string().trim().min(1).max(100).optional(),
    signingSecret: z.string().min(24).max(500).optional(),
    customHeaders,
    username: z.string().trim().max(80).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (["slack", "discord"].includes(data.provider) && !data.webhookUrl)
      ctx.addIssue({
        code: "custom",
        path: ["webhookUrl"],
        message: "Webhook URL is required",
      });
    if (
      data.provider === "slack" &&
      data.webhookUrl &&
      !/^https:\/\/hooks\.slack\.com\/services\//i.test(data.webhookUrl)
    )
      ctx.addIssue({
        code: "custom",
        path: ["webhookUrl"],
        message: "Enter a Slack incoming webhook URL",
      });
    if (
      data.provider === "discord" &&
      data.webhookUrl &&
      !/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//i.test(
        data.webhookUrl,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["webhookUrl"],
        message: "Enter a Discord webhook URL",
      });
    if (
      data.provider === "telegram" &&
      (!data.botToken ||
        !/^\d+:[A-Za-z0-9_-]{20,}$/.test(data.botToken) ||
        !data.chatId)
    )
      ctx.addIssue({
        code: "custom",
        path: ["botToken"],
        message: "A valid Telegram bot token and chat ID are required",
      });
    if (
      data.provider === "webhook" &&
      (!data.endpointUrl || !data.signingSecret)
    )
      ctx.addIssue({
        code: "custom",
        path: ["endpointUrl"],
        message: "Webhook endpoint and signing secret are required",
      });
  });

export const integrationUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    webhookUrl: httpsUrl.optional(),
    endpointUrl: httpsUrl.optional(),
    botToken: z.string().min(25).max(200).optional(),
    chatId: z.string().trim().min(1).max(100).optional(),
    signingSecret: z.string().min(24).max(500).optional(),
    username: z.string().trim().max(80).optional(),
    customHeaders,
    isActive: z.boolean().optional(),
  })
  .strict();

const ids = z
  .array(z.string().regex(/^[a-f\d]{24}$/i))
  .max(50)
  .default([]);
const idList = z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(50);
export const notificationRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    integrationIds: ids,
    events: z.array(z.enum(ALERT_EVENTS)).min(1).max(ALERT_EVENTS.length),
    filters: z
      .object({
        monitorIds: ids,
        severity: z
          .array(
            z.enum(["critical", "major", "minor", "high", "normal", "low"]),
          )
          .max(6)
          .default([]),
      })
      .strict()
      .default({}),
    isActive: z.boolean().default(true),
  })
  .strict();

const escalationStep = z
  .object({
    afterMinutes: z.number().int().min(1).max(10_080),
    integrationIds: ids,
    priority: z.enum(["normal", "high", "critical"]).default("high"),
  })
  .strict();
export const alertPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    triggerEvents: z
      .array(z.enum(["incident.created", "monitor.down"]))
      .min(1)
      .max(2),
    initialIntegrationIds: ids,
    escalationSteps: z.array(escalationStep).max(10).default([]),
    repeatPolicy: z
      .object({
        enabled: z.boolean().default(false),
        intervalMinutes: z.number().int().min(5).max(10_080).default(30),
        maxRepeats: z.number().int().min(0).max(20).default(3),
        integrationIds: ids,
      })
      .strict()
      .default({}),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.escalationSteps.some(
        (step, index) =>
          index &&
          step.afterMinutes <= data.escalationSteps[index - 1].afterMinutes,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["escalationSteps"],
        message: "Escalation delays must be strictly increasing",
      });
  });
export const notificationRuleUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    integrationIds: idList.optional(),
    events: z
      .array(z.enum(ALERT_EVENTS))
      .min(1)
      .max(ALERT_EVENTS.length)
      .optional(),
    filters: z
      .object({
        monitorIds: idList.optional(),
        severity: z
          .array(
            z.enum(["critical", "major", "minor", "high", "normal", "low"]),
          )
          .max(6)
          .optional(),
      })
      .strict()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one rule field to update",
  );
export const alertPolicyUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    triggerEvents: z
      .array(z.enum(["incident.created", "monitor.down"]))
      .min(1)
      .max(2)
      .optional(),
    initialIntegrationIds: idList.optional(),
    escalationSteps: z.array(escalationStep).max(10).optional(),
    repeatPolicy: z
      .object({
        enabled: z.boolean().optional(),
        intervalMinutes: z.number().int().min(5).max(10_080).optional(),
        maxRepeats: z.number().int().min(0).max(20).optional(),
        integrationIds: idList.optional(),
      })
      .strict()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!Object.keys(data).length)
      ctx.addIssue({
        code: "custom",
        message: "Provide at least one policy field to update",
      });
    if (
      data.escalationSteps?.some(
        (step, index) =>
          index &&
          step.afterMinutes <= data.escalationSteps[index - 1].afterMinutes,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["escalationSteps"],
        message: "Escalation delays must be strictly increasing",
      });
  });
export const deliveryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z
      .enum([
        "pending",
        "processing",
        "delivered",
        "failed",
        "dead_letter",
        "cancelled",
      ])
      .optional(),
    provider: z.enum(["slack", "discord", "telegram", "webhook"]).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate <= data.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be later than start date",
      });
  });
