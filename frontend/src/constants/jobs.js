export const JOB_STATUS = Object.freeze({
  PENDING: "pending",
  UP: "up",
  LATE: "late",
  DOWN: "down",
  PAUSED: "paused",
});

export const JOB_RUN_STATUS = Object.freeze({
  STARTED: "started",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  TIMED_OUT: "timed_out",
  MISSED: "missed",
});

export const JOB_SCHEDULE_TYPES = Object.freeze({
  INTERVAL: "interval",
  CRON: "cron",
});

export const INTERVAL_PRESETS = [
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 300 },
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 21600 },
  { label: "12 hours", value: 43200 },
  { label: "24 hours (1 day)", value: 86400 },
];

export const CRON_PRESETS = [
  { label: "Every 5 minutes", expression: "*/5 * * * *" },
  { label: "Every 15 minutes", expression: "*/15 * * * *" },
  { label: "Every hour (at minute 0)", expression: "0 * * * *" },
  { label: "Every 6 hours", expression: "0 */6 * * *" },
  { label: "Every day at midnight", expression: "0 0 * * *" },
  { label: "Every day at 9:00 AM", expression: "0 9 * * *" },
  { label: "Every weekday at midnight", expression: "0 0 * * 1-5" },
  { label: "Every Sunday at midnight", expression: "0 0 * * 0" },
  { label: "First day of month at midnight", expression: "0 0 1 * *" },
];

export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];
