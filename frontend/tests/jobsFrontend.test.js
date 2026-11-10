import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

import { validateCron, describeCron } from "../src/utils/cronParser.js";
import {
  describeInterval,
  formatExecutionDuration,
  getJobStatusBadgeProps,
  getJobRunStatusBadgeProps,
  generateHeartbeatSnippets,
} from "../src/utils/jobFormat.js";
import { JOB_STATUS, JOB_RUN_STATUS } from "../src/constants/jobs.js";
import { FEATURES, planHasFeature } from "../src/constants/features.js";
import * as jobsApi from "../src/services/api/jobs.js";

let viteServer;
let JobStatusBadge;
let JobRunStatusBadge;
let JobSchedulePreview;
let JobDurationChart;

test.before(async () => {
  viteServer = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  const badgeMod = await viteServer.ssrLoadModule(
    "./src/components/jobs/JobStatusBadge.jsx",
  );
  JobStatusBadge = badgeMod.default;

  const runBadgeMod = await viteServer.ssrLoadModule(
    "./src/components/jobs/JobRunStatusBadge.jsx",
  );
  JobRunStatusBadge = runBadgeMod.default;

  const previewMod = await viteServer.ssrLoadModule(
    "./src/components/jobs/JobSchedulePreview.jsx",
  );
  JobSchedulePreview = previewMod.default;

  const chartMod = await viteServer.ssrLoadModule(
    "./src/components/jobs/JobDurationChart.jsx",
  );
  JobDurationChart = chartMod.default;
});

test.after(async () => {
  if (viteServer) {
    await viteServer.close();
  }
});

const clean = (html) => html.replace(/<!--.*?-->/g, "");

// ----------------------------------------------------------------------------
// 1. Cron Validation & Formatting
// ----------------------------------------------------------------------------

test("Cron Parser: validates standard 5-part cron expressions and aliases", () => {
  // Valid expressions
  assert.equal(validateCron("0 0 * * *").valid, true);
  assert.equal(validateCron("*/15 * * * *").valid, true);
  assert.equal(validateCron("0 9 * * 1-5").valid, true);
  assert.equal(validateCron("@daily").valid, true);
  assert.equal(validateCron("@hourly").valid, true);
  assert.equal(validateCron("@weekly").valid, true);

  // Invalid expressions
  assert.equal(validateCron("").valid, false);
  assert.equal(validateCron("invalid-cron").valid, false);
  assert.equal(validateCron("0 0 * *").valid, false, "Must have 5 fields");
  assert.equal(validateCron("60 * * * *").valid, false, "Minute must be 0-59");
  assert.equal(validateCron("* 25 * * *").valid, false, "Hour must be 0-23");
  assert.equal(validateCron("* * 32 * *").valid, false, "Day must be 1-31");
  assert.equal(validateCron("* * * 13 *").valid, false, "Month must be 1-12");
  assert.equal(
    validateCron("* * * * 8").valid,
    false,
    "Day of week must be 0-7",
  );
});

test("Cron Parser: describes cron schedules accurately in plain English", () => {
  assert.match(describeCron("@daily", "UTC"), /Every day at midnight/);
  assert.match(describeCron("@hourly", "UTC"), /Every hour at minute 0/);
  assert.match(describeCron("* * * * *", "UTC"), /Every minute/);
  assert.match(describeCron("*/15 * * * *", "UTC"), /Every 15 minutes/);
  assert.match(describeCron("0 0 * * *", "UTC"), /Every day at 00:00/);
  assert.match(
    describeCron("0 9 * * 1-5", "UTC"),
    /Weekdays \(Mon-Fri\) at 09:00/,
  );
  assert.match(
    describeCron("0 0 1 * *", "UTC"),
    /On the 1st of every month at 00:00/,
  );
  assert.match(describeCron("0 0 * * 0", "UTC"), /Every Sunday at 00:00/);
});

// ----------------------------------------------------------------------------
// 2. Interval & Duration Formatting
// ----------------------------------------------------------------------------

test("Job Formatting: interval and execution duration helpers", () => {
  assert.equal(describeInterval(60), "Every minute");
  assert.equal(describeInterval(300), "Every 5 minutes");
  assert.equal(describeInterval(900), "Every 15 minutes");
  assert.equal(describeInterval(3600), "Every hour");
  assert.equal(describeInterval(21600), "Every 6 hours");
  assert.equal(describeInterval(86400), "Every day");
  assert.equal(describeInterval(null), "—");

  assert.equal(formatExecutionDuration(245), "245ms");
  assert.equal(formatExecutionDuration(1500), "1.50s");
  assert.equal(formatExecutionDuration(65000), "1m 5s");
  assert.equal(formatExecutionDuration(3665000), "1h 1m");
  assert.equal(formatExecutionDuration(null), "—");
});

// ----------------------------------------------------------------------------
// 3. Status Badges Props & Classifications
// ----------------------------------------------------------------------------

test("Job Status Props: maps operational, late, down, and paused states", () => {
  const up = getJobStatusBadgeProps(JOB_STATUS.UP, true);
  assert.equal(up.label, "Operational");
  assert.equal(up.tone, "up");

  const late = getJobStatusBadgeProps(JOB_STATUS.LATE, true);
  assert.equal(late.label, "Late");
  assert.equal(late.tone, "late");

  const down = getJobStatusBadgeProps(JOB_STATUS.DOWN, true);
  assert.equal(down.label, "Down");
  assert.equal(down.tone, "down");

  const paused = getJobStatusBadgeProps(JOB_STATUS.UP, false);
  assert.equal(paused.label, "Paused");
  assert.equal(paused.tone, "paused");

  const pending = getJobStatusBadgeProps(JOB_STATUS.PENDING, true);
  assert.equal(pending.label, "Awaiting Ping");
});

test("Job Run Status Props: maps execution outcomes", () => {
  assert.equal(
    getJobRunStatusBadgeProps(JOB_RUN_STATUS.SUCCEEDED).label,
    "Succeeded",
  );
  assert.equal(
    getJobRunStatusBadgeProps(JOB_RUN_STATUS.FAILED).label,
    "Failed",
  );
  assert.equal(
    getJobRunStatusBadgeProps(JOB_RUN_STATUS.TIMED_OUT).label,
    "Timed Out",
  );
  assert.equal(
    getJobRunStatusBadgeProps(JOB_RUN_STATUS.MISSED).label,
    "Missed",
  );
  assert.equal(
    getJobRunStatusBadgeProps(JOB_RUN_STATUS.STARTED).label,
    "Running",
  );
});

// ----------------------------------------------------------------------------
// 4. Heartbeat Code Snippets Generation
// ----------------------------------------------------------------------------

test("Heartbeat Snippets: generates valid cURL, Node.js, and Python examples", () => {
  const snippets = generateHeartbeatSnippets({
    jobMonitorId: "64b0000000000000000000a1",
    token: "jm_live_test_token_123456",
    origin: "https://api.sitewatch.com",
  });

  assert.ok(
    snippets.reportingUrl.includes(
      "/api/job-heartbeats/64b0000000000000000000a1",
    ),
  );

  // cURL checks
  assert.ok(snippets.curl.includes("curl -s -X POST"));
  assert.ok(snippets.curl.includes("Bearer jm_live_test_token_123456"));
  assert.ok(snippets.curl.includes('"event":"started"'));
  assert.ok(snippets.curl.includes('"event":"succeeded"'));

  // Node.js checks
  assert.ok(snippets.nodejs.includes("fetch(REPORTING_URL"));
  assert.ok(snippets.nodejs.includes('event: "started"'));
  assert.ok(snippets.nodejs.includes('event: "failed"'));

  // Python checks
  assert.ok(snippets.python.includes("import requests"));
  assert.ok(snippets.python.includes('"event": "succeeded"'));
});

// ----------------------------------------------------------------------------
// 5. Subscription Plan Feature Gating
// ----------------------------------------------------------------------------

test("Subscription Enforcement: planHasFeature gates JOB_MONITORING across tiers", () => {
  const freePlan = {
    limits: {
      maxJobMonitors: 5,
    },
  };
  const unlimitedPlan = {
    limits: {
      maxJobMonitors: null,
    },
  };
  const zeroPlan = {
    limits: {
      maxJobMonitors: 0,
    },
  };

  assert.equal(planHasFeature(freePlan, FEATURES.JOB_MONITORING), true);
  assert.equal(planHasFeature(unlimitedPlan, FEATURES.JOB_MONITORING), true);
  assert.equal(planHasFeature(zeroPlan, FEATURES.JOB_MONITORING), false);
  assert.equal(planHasFeature(null, FEATURES.JOB_MONITORING), false);
});

// ----------------------------------------------------------------------------
// 6. Component SSR Rendering: JobStatusBadge & JobRunStatusBadge
// ----------------------------------------------------------------------------

test("JobStatusBadge Component: renders badges, tones, and accessibility attributes", () => {
  const operationalHtml = renderToString(
    React.createElement(JobStatusBadge, { status: "up", active: true }),
  );
  assert.ok(operationalHtml.includes("Operational"));
  assert.ok(operationalHtml.includes("bg-emerald-50"));

  const lateHtml = renderToString(
    React.createElement(JobStatusBadge, { status: "late", active: true }),
  );
  assert.ok(lateHtml.includes("Late"));
  assert.ok(lateHtml.includes("bg-amber-50"));

  const pausedHtml = renderToString(
    React.createElement(JobStatusBadge, { status: "up", active: false }),
  );
  assert.ok(pausedHtml.includes("Paused"));
  assert.ok(pausedHtml.includes("bg-slate-100"));
});

test("JobRunStatusBadge Component: renders run status outcomes", () => {
  const succHtml = renderToString(
    React.createElement(JobRunStatusBadge, { status: "succeeded" }),
  );
  assert.ok(succHtml.includes("Succeeded"));

  const failHtml = renderToString(
    React.createElement(JobRunStatusBadge, { status: "failed" }),
  );
  assert.ok(failHtml.includes("Failed"));

  const timeoutHtml = renderToString(
    React.createElement(JobRunStatusBadge, { status: "timed_out" }),
  );
  assert.ok(timeoutHtml.includes("Timed Out"));

  const missedHtml = renderToString(
    React.createElement(JobRunStatusBadge, { status: "missed" }),
  );
  assert.ok(missedHtml.includes("Missed"));
});

// ----------------------------------------------------------------------------
// 7. Component SSR Rendering: JobSchedulePreview
// ----------------------------------------------------------------------------

test("JobSchedulePreview Component: renders schedule feedback and validation", () => {
  const validCronHtml = renderToString(
    React.createElement(JobSchedulePreview, {
      scheduleType: "cron",
      cronExpression: "0 0 * * *",
      timezone: "UTC",
    }),
  );
  assert.ok(clean(validCronHtml).includes("Schedule Preview"));
  assert.ok(clean(validCronHtml).includes("Every day at 00:00"));

  const invalidCronHtml = renderToString(
    React.createElement(JobSchedulePreview, {
      scheduleType: "cron",
      cronExpression: "bad-cron",
      timezone: "UTC",
    }),
  );
  assert.ok(clean(invalidCronHtml).includes("Invalid Schedule"));

  const intervalHtml = renderToString(
    React.createElement(JobSchedulePreview, {
      scheduleType: "interval",
      intervalSeconds: 900,
    }),
  );
  assert.ok(clean(intervalHtml).includes("Every 15 minutes"));
});

// ----------------------------------------------------------------------------
// 8. Component SSR Rendering: JobDurationChart
// ----------------------------------------------------------------------------

test("JobDurationChart Component: renders without error for empty and populated data", () => {
  const emptyHtml = renderToString(
    React.createElement(JobDurationChart, { runs: [] }),
  );
  assert.ok(emptyHtml.includes("No execution data available"));

  const populatedHtml = renderToString(
    React.createElement(JobDurationChart, {
      runs: [
        {
          _id: "run-1",
          runId: "run-1",
          status: "succeeded",
          durationMs: 450,
          completedAt: new Date().toISOString(),
        },
      ],
    }),
  );
  assert.ok(populatedHtml.includes("job-duration-chart"));
});

// ----------------------------------------------------------------------------
// 9. API Client Exports Verification
// ----------------------------------------------------------------------------

test("API Client: Verifies all Job API client functions are exported and callable", () => {
  assert.equal(typeof jobsApi.getJobMonitors, "function");
  assert.equal(typeof jobsApi.getJobMonitorById, "function");
  assert.equal(typeof jobsApi.createJobMonitor, "function");
  assert.equal(typeof jobsApi.updateJobMonitor, "function");
  assert.equal(typeof jobsApi.deleteJobMonitor, "function");
  assert.equal(typeof jobsApi.rotateJobMonitorToken, "function");
  assert.equal(typeof jobsApi.toggleJobMonitorPause, "function");
  assert.equal(typeof jobsApi.getJobRuns, "function");
});
