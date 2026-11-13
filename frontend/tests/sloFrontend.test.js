import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

import {
  getWindowSeconds,
  calculateAllowableDowntime,
  formatBudgetDuration,
  formatBurnRate,
  formatExhaustionHours,
  formatPercentage,
  getSloStatus,
} from "../src/utils/sloFormat.js";

import { FEATURES, planHasFeature } from "../src/constants/features.js";
import { formatDateTime } from "../src/utils/format.js";
import * as slosApi from "../src/services/api/slos.js";

// Vite server to load JSX components for testing in SSR environment
let viteServer;
let SloStatusBadge;
let ErrorBudgetMeter;
let BurnRateCard;
let ExhaustionForecastCard;
let SloAlertStatePanel;
let SloHistoryChart;
let SloFormModal;

test.before(async () => {
  viteServer = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  const badgeMod = await viteServer.ssrLoadModule(
    "./src/components/slo/SloStatusBadge.jsx",
  );
  SloStatusBadge = badgeMod.default;

  const meterMod = await viteServer.ssrLoadModule(
    "./src/components/slo/ErrorBudgetMeter.jsx",
  );
  ErrorBudgetMeter = meterMod.default;

  const burnMod = await viteServer.ssrLoadModule(
    "./src/components/slo/BurnRateCard.jsx",
  );
  BurnRateCard = burnMod.default;

  const forecastMod = await viteServer.ssrLoadModule(
    "./src/components/slo/ExhaustionForecastCard.jsx",
  );
  ExhaustionForecastCard = forecastMod.default;

  const alertMod = await viteServer.ssrLoadModule(
    "./src/components/slo/SloAlertStatePanel.jsx",
  );
  SloAlertStatePanel = alertMod.default;

  const chartMod = await viteServer.ssrLoadModule(
    "./src/components/slo/SloHistoryChart.jsx",
  );
  SloHistoryChart = chartMod.default;

  const modalMod = await viteServer.ssrLoadModule(
    "./src/components/slo/SloFormModal.jsx",
  );
  SloFormModal = modalMod.default;
});

test.after(async () => {
  if (viteServer) {
    await viteServer.close();
  }
});

const clean = (html) => html.replace(/<!--.*?-->/g, "");

// ----------------------------------------------------------------------------
// 1. Math and Formatting Unit Tests
// ----------------------------------------------------------------------------
test("SLO Math: Window seconds and allowable downtime calculations", () => {
  assert.equal(getWindowSeconds("7d"), 7 * 86400);
  assert.equal(getWindowSeconds("14d"), 14 * 86400);
  assert.equal(getWindowSeconds("30d"), 30 * 86400);
  assert.equal(getWindowSeconds("90d"), 90 * 86400);

  // 99.0% over 30d -> 1% of 2,592,000s = 25,920s = 7h 12m
  assert.equal(calculateAllowableDowntime(99.0, "30d"), "7h 12m");

  // 99.9% over 30d -> 0.1% of 2,592,000s = 2,592s = 43m 12s
  assert.equal(calculateAllowableDowntime(99.9, "30d"), "43m 12s");

  // 99.95% over 30d -> 0.05% of 2,592,000s = 1,296s = 21m 36s
  assert.equal(calculateAllowableDowntime(99.95, "30d"), "21m 36s");

  // 99.99% over 30d -> 0.01% of 2,592,000s = 259.2s -> 4m 19s
  assert.equal(calculateAllowableDowntime(99.99, "30d"), "4m 19s");

  // 99.9% over 7d -> 0.1% of 604,800s = 604.8s -> 10m 5s
  assert.equal(calculateAllowableDowntime(99.9, "7d"), "10m 5s");
});

test("SLO Formatting: Budget duration, burn rate, and exhaustion hours", () => {
  // Budget duration
  assert.equal(formatBudgetDuration(null), "—");
  assert.equal(formatBudgetDuration(0), "0s");
  assert.equal(formatBudgetDuration(864), "+14m 24s");
  assert.equal(formatBudgetDuration(-2712), "-45m 12s");

  // Burn rate
  assert.equal(formatBurnRate(null), "0.0x");
  assert.equal(formatBurnRate(0), "0.0x");
  assert.equal(formatBurnRate(1.234), "1.2x");
  assert.equal(formatBurnRate(14.4), "14.4x");

  // Percentage
  assert.equal(formatPercentage(99.9512, 2), "99.95%");
  assert.equal(formatPercentage(null), "—");

  // Exhaustion hours
  assert.equal(formatExhaustionHours(0), "Already exhausted");
  assert.equal(formatExhaustionHours(0.5), "30 minutes");
  assert.equal(formatExhaustionHours(6.5), "6.5 hours");
  assert.equal(formatExhaustionHours(48), "2.0 days");
  assert.equal(formatExhaustionHours(null), "N/A");
});

// ----------------------------------------------------------------------------
// 2. State Classification Engine Tests
// ----------------------------------------------------------------------------
test("SLO State Classification: Disabled, Insufficient Data, Over-Budget, Breached, Warning, and Healthy", () => {
  // Disabled state
  const disabled = getSloStatus({ enabled: false });
  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.tone, "gray");

  // Insufficient data (< 50% coverage)
  const insufficientData = getSloStatus({
    enabled: true,
    sli: 100,
    target: 99.9,
    dataCoveragePct: 42,
  });
  assert.equal(insufficientData.status, "insufficient_data");
  assert.equal(insufficientData.tone, "yellow");

  // Over-budget / exhausted (remaining budget <= 0)
  const overBudget = getSloStatus({
    enabled: true,
    sli: 99.8,
    target: 99.9,
    remainingBudgetSeconds: -120,
    allowedErrorBudgetSeconds: 2592,
  });
  assert.equal(overBudget.status, "exhausted");
  assert.equal(overBudget.tone, "red");

  // Breached (SLI < target)
  const breached = getSloStatus({
    enabled: true,
    sli: 99.85,
    target: 99.9,
    remainingBudgetSeconds: 50,
    allowedErrorBudgetSeconds: 2592,
  });
  assert.equal(breached.status, "breached");
  assert.equal(breached.tone, "red");

  // Warning (remaining < 20% of allowed budget)
  const warning = getSloStatus({
    enabled: true,
    sli: 99.92,
    target: 99.9,
    remainingBudgetSeconds: 400,
    allowedErrorBudgetSeconds: 2592, // 400 / 2592 = 15.4% < 20%
  });
  assert.equal(warning.status, "warning");
  assert.equal(warning.tone, "yellow");

  // Normal / Healthy
  const healthy = getSloStatus({
    enabled: true,
    sli: 99.95,
    target: 99.9,
    remainingBudgetSeconds: 2000,
    allowedErrorBudgetSeconds: 2592,
  });
  assert.equal(healthy.status, "healthy");
  assert.equal(healthy.tone, "green");
});

// ----------------------------------------------------------------------------
// 3. Plan Entitlement Tests
// ----------------------------------------------------------------------------
test("Subscription Enforcement: planHasFeature gates SLO_MANAGEMENT across tiers", () => {
  const freePlan = { limits: { maxSlos: 0 } };
  const proPlan = { limits: { maxSlos: 5 } };
  const enterprisePlan = { limits: { maxSlos: null } };

  assert.equal(planHasFeature(freePlan, FEATURES.SLO_MANAGEMENT), false);
  assert.equal(planHasFeature(proPlan, FEATURES.SLO_MANAGEMENT), true);
  assert.equal(planHasFeature(enterprisePlan, FEATURES.SLO_MANAGEMENT), true);
  assert.equal(planHasFeature(null, FEATURES.SLO_MANAGEMENT), false);
});

// ----------------------------------------------------------------------------
// 4. Component Rendering: SloStatusBadge
// ----------------------------------------------------------------------------
test("SloStatusBadge Component: Renders correct badges, tones, and accessibility attributes", () => {
  // Normal / Healthy
  const healthyHtml = renderToString(
    React.createElement(SloStatusBadge, {
      enabled: true,
      sli: 99.95,
      target: 99.9,
      remainingBudgetSeconds: 1500,
      allowedErrorBudgetSeconds: 2592,
    }),
  );
  assert.ok(healthyHtml.includes('role="status"'));
  assert.ok(healthyHtml.includes('aria-label="SLO status: Healthy"'));
  assert.ok(healthyHtml.includes("Healthy"));
  assert.ok(healthyHtml.includes("bg-emerald-100"));

  // Breached
  const breachedHtml = renderToString(
    React.createElement(SloStatusBadge, {
      enabled: true,
      sli: 99.5,
      target: 99.9,
    }),
  );
  assert.ok(breachedHtml.includes("Breached"));
  assert.ok(breachedHtml.includes("bg-rose-100"));

  // Budget Exhausted
  const exhaustedHtml = renderToString(
    React.createElement(SloStatusBadge, {
      enabled: true,
      remainingBudgetSeconds: -50,
      alertStatus: "exhausted",
    }),
  );
  assert.ok(exhaustedHtml.includes("Budget Exhausted"));
  assert.ok(exhaustedHtml.includes("bg-rose-100"));

  // Insufficient Data
  const noDataHtml = renderToString(
    React.createElement(SloStatusBadge, {
      enabled: true,
      dataCoveragePct: 30,
    }),
  );
  assert.ok(noDataHtml.includes("Insufficient Data"));
  assert.ok(noDataHtml.includes("bg-amber-100"));

  // Disabled
  const disabledHtml = renderToString(
    React.createElement(SloStatusBadge, {
      enabled: false,
    }),
  );
  assert.ok(disabledHtml.includes("Disabled"));
  assert.ok(disabledHtml.includes("bg-gray-100"));
});

// ----------------------------------------------------------------------------
// 5. Component Rendering: ErrorBudgetMeter
// ----------------------------------------------------------------------------
test("ErrorBudgetMeter Component: Progressbar attributes, breakdown durations, and states", () => {
  // Normal state
  const meterHtml = renderToString(
    React.createElement(ErrorBudgetMeter, {
      allowedErrorBudgetSeconds: 2592,
      consumedBudgetSeconds: 592,
      remainingBudgetSeconds: 2000,
      remainingBudgetPercentage: 77.2,
      budgetConsumptionPercentage: 22.8,
      goodDurationSeconds: 2500000,
      badDurationSeconds: 592,
      unknownDurationSeconds: 120,
      maintenanceDurationSeconds: 3600,
    }),
  );

  assert.ok(meterHtml.includes('role="progressbar"'));
  assert.ok(meterHtml.includes('aria-valuenow="77"'));
  assert.ok(meterHtml.includes("Within Budget"));
  assert.ok(meterHtml.includes("+33m 20s"));
  assert.ok(meterHtml.includes("Good Duration"));
  assert.ok(meterHtml.includes("Bad Duration"));
  assert.ok(meterHtml.includes("Unknown Duration"));
  assert.ok(meterHtml.includes("Never counted as success"));
  assert.ok(meterHtml.includes("Maintenance"));
  assert.ok(meterHtml.includes("Excluded from calculation"));

  // Depleted / Over-budget state
  const depletedHtml = renderToString(
    React.createElement(ErrorBudgetMeter, {
      allowedErrorBudgetSeconds: 2592,
      consumedBudgetSeconds: 3000,
      remainingBudgetSeconds: -408,
      remainingBudgetPercentage: -15.7,
      budgetConsumptionPercentage: 115.7,
    }),
  );

  assert.ok(depletedHtml.includes("Depleted"));
  assert.ok(depletedHtml.includes("-6m 48s"));
  assert.ok(depletedHtml.includes("bg-rose-500"));

  // Compact mode
  const compactHtml = renderToString(
    React.createElement(ErrorBudgetMeter, {
      remainingBudgetSeconds: 1500,
      remainingBudgetPercentage: 60.0,
      compact: true,
    }),
  );
  assert.ok(compactHtml.includes("Budget:"));
  assert.ok(compactHtml.includes("+25m"));
  assert.ok(compactHtml.includes("60.0%"));
});

// ----------------------------------------------------------------------------
// 6. Component Rendering: BurnRateCard
// ----------------------------------------------------------------------------
test("BurnRateCard Component: Multi-window burn indicators, thresholds, and evidence safeguards", () => {
  // Normal burn rate with trustworthy telemetry
  const normalHtml = renderToString(
    React.createElement(BurnRateCard, {
      window: "1h",
      rate: 0.8,
      thresholdRate: 2.0,
      hasSufficientEvidence: true,
      sampleCount: 60,
      eligibleDurationSeconds: 3600,
      errorRatePercentage: 0.08,
    }),
  );
  assert.ok(clean(normalHtml).includes("1 Hour Lookback"));
  assert.ok(clean(normalHtml).includes("0.8x"));
  assert.ok(clean(normalHtml).includes("Normal"));
  assert.ok(clean(normalHtml).includes("Defensible telemetry"));

  // Critical alerting burn rate
  const criticalHtml = renderToString(
    React.createElement(BurnRateCard, {
      window: "5m",
      rate: 15.2,
      thresholdRate: 14.4,
      hasSufficientEvidence: true,
      sampleCount: 5,
      eligibleDurationSeconds: 300,
      errorRatePercentage: 1.52,
    }),
  );
  assert.ok(clean(criticalHtml).includes("5 Minutes Lookback"));
  assert.ok(clean(criticalHtml).includes("15.2x"));
  assert.ok(clean(criticalHtml).includes("Critical Burn"));
  assert.ok(clean(criticalHtml).includes("/ alert @ 14.4x"));

  // Isolated check failure rejection (suppressed alert)
  const suppressedHtml = renderToString(
    React.createElement(BurnRateCard, {
      window: "5m",
      rate: 20.0,
      thresholdRate: 14.4,
      hasSufficientEvidence: false,
      evidenceReason: "isolated_check",
      sampleCount: 1,
      eligibleDurationSeconds: 60,
    }),
  );
  assert.ok(clean(suppressedHtml).includes("Isolated check spike suppressed"));
  assert.ok(!clean(suppressedHtml).includes("Critical Burn")); // Critical alert badge must NOT show when evidence is rejected

  // Insufficient samples
  const samplesHtml = renderToString(
    React.createElement(BurnRateCard, {
      window: "30m",
      rate: 6.5,
      thresholdRate: 6.0,
      hasSufficientEvidence: false,
      evidenceReason: "insufficient_samples",
    }),
  );
  assert.ok(clean(samplesHtml).includes("Fewer than 2 checks in window"));
});

// ----------------------------------------------------------------------------
// 7. Component Rendering: ExhaustionForecastCard
// ----------------------------------------------------------------------------
test("ExhaustionForecastCard Component: Renders 4 forecast states and Estimate badge", () => {
  // 1. Forecasted state
  const forecastedHtml = renderToString(
    React.createElement(ExhaustionForecastCard, {
      forecast: {
        status: "forecasted",
        hoursToExhaustion: 12.5,
        projectedExhaustionAt: new Date("2026-11-12T16:00:00Z").toISOString(),
        burnRateUsed: 2.4,
        lookbackWindowUsed: "1h",
      },
    }),
  );
  assert.ok(clean(forecastedHtml).includes("Exhaustion Forecast"));
  assert.ok(clean(forecastedHtml).includes("Estimate"));
  assert.ok(clean(forecastedHtml).includes("~12.5 hours"));
  assert.ok(clean(forecastedHtml).includes("2.4x allowable rate"));

  // 2. Already exhausted state
  const exhaustedHtml = renderToString(
    React.createElement(ExhaustionForecastCard, {
      forecast: {
        status: "already_exhausted",
      },
    }),
  );
  assert.ok(clean(exhaustedHtml).includes("Budget Already Exhausted"));
  assert.ok(clean(exhaustedHtml).includes("increase budget deficit"));

  // 3. Not exhausting (zero burn) state
  const zeroBurnHtml = renderToString(
    React.createElement(ExhaustionForecastCard, {
      forecast: {
        status: "not_exhausting",
      },
    }),
  );
  assert.ok(clean(zeroBurnHtml).includes("Zero Active Burn"));
  assert.ok(
    clean(zeroBurnHtml).includes("Error budget is healthy and not depleting"),
  );

  // 4. Unavailable state
  const unavailableHtml = renderToString(
    React.createElement(ExhaustionForecastCard, {
      forecast: {
        status: "unavailable",
      },
    }),
  );
  assert.ok(clean(unavailableHtml).includes("Forecast Unavailable"));
  assert.ok(
    clean(unavailableHtml).includes("Insufficient recent observations"),
  );
});

// ----------------------------------------------------------------------------
// 8. Component Rendering: SloAlertStatePanel
// ----------------------------------------------------------------------------
test("SloAlertStatePanel Component: Renders healthy lifecycle and active alert conditions", () => {
  // Healthy alert state
  const healthyHtml = renderToString(
    React.createElement(SloAlertStatePanel, {
      alertState: {
        status: "healthy",
        activeAlerts: [],
        incidentSequence: 3,
        consecutiveBreaches: 0,
        consecutiveRecoveries: 2,
        lastResolvedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    }),
  );
  assert.ok(clean(healthyHtml).includes("Alert State"));
  assert.ok(clean(healthyHtml).includes("Incident Lifecycle"));
  assert.ok(clean(healthyHtml).includes("healthy"));
  assert.ok(clean(healthyHtml).includes("No active alert conditions"));
  assert.ok(clean(healthyHtml).includes("#3"));

  // Active alert conditions
  const activeAlertsHtml = renderToString(
    React.createElement(SloAlertStatePanel, {
      alertState: {
        status: "breached",
        incidentSequence: 4,
        consecutiveBreaches: 2,
        consecutiveRecoveries: 0,
        activeAlerts: [
          {
            type: "burn_rate",
            window: "5m",
            severity: "critical",
            rate: 15.4,
            thresholdRate: 14.4,
            dedupeKey: "slo-123:burn_rate:5m:4",
            triggeredAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  assert.ok(clean(activeAlertsHtml).includes("Active Alert Conditions (1)"));
  assert.ok(clean(activeAlertsHtml).includes("burn rate (5m)"));
  assert.ok(clean(activeAlertsHtml).includes("critical"));
  assert.ok(clean(activeAlertsHtml).includes("15.4x"));
  assert.ok(clean(activeAlertsHtml).includes("slo-123:burn_rate:5m:4"));
});

// ----------------------------------------------------------------------------
// 9. Component Rendering: SloHistoryChart Empty State
// ----------------------------------------------------------------------------
test("SloHistoryChart Component: Renders guidance empty state when snapshots array is empty", () => {
  const emptyChartHtml = renderToString(
    React.createElement(SloHistoryChart, {
      snapshots: [],
      target: 99.9,
    }),
  );
  assert.ok(
    clean(emptyChartHtml).includes(
      "No historical evaluation snapshots recorded yet",
    ),
  );
  assert.ok(clean(emptyChartHtml).includes("Run an on-demand evaluation"));
});

test("SloHistoryChart Component: Renders with snapshots and correlates deployment release markers", () => {
  const snapshots = [
    {
      evaluatedAt: new Date(Date.now() - 3600000).toISOString(),
      sliPercentage: 99.95,
      remainingBudgetSeconds: 500,
      consumedBudgetSeconds: 20,
      dataCoveragePercentage: 100,
    },
    {
      evaluatedAt: new Date().toISOString(),
      sliPercentage: 99.75,
      remainingBudgetSeconds: 400,
      consumedBudgetSeconds: 120,
      dataCoveragePercentage: 100,
    },
  ];

  // Deployment within snap distance (30 min ago — within the 1-hour chart)
  const deploymentInRange = {
    id: "dep-1",
    version: "v2.5.0",
    deployedAt: new Date(Date.now() - 1800000).toISOString(),
  };

  // Deployment 25 hours ago — outside the chart range entirely
  const deploymentOutOfRange = {
    id: "dep-2",
    version: "v1.0.0",
    deployedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
  };

  const chartHtml = renderToString(
    React.createElement(SloHistoryChart, {
      snapshots,
      target: 99.9,
      deployments: [deploymentInRange, deploymentOutOfRange],
    }),
  );

  assert.ok(clean(chartHtml).includes("recharts-responsive-container"));
  // In-range marker version should appear in rendered output (ReferenceLine label)
  assert.ok(
    clean(chartHtml).includes("v2.5.0"),
    "Release marker within snap distance must appear in chart HTML",
  );
  assert.ok(
    clean(chartHtml).includes(
      `v2.5.0 deployed at ${formatDateTime(deploymentInRange.deployedAt)}`,
    ),
    "Release marker tooltip must expose the exact deployment timestamp",
  );
  // Out-of-range marker must be excluded
  assert.ok(
    !clean(chartHtml).includes("v1.0.0"),
    "Release marker outside chart timeline must not appear in chart HTML",
  );
});

// ----------------------------------------------------------------------------
// 10. Component Rendering: SloFormModal Dialog
// ----------------------------------------------------------------------------
test("SloFormModal Component: Modal dialog structure, accessibility role, and presets", () => {
  const modalHtml = renderToString(
    React.createElement(SloFormModal, {
      isOpen: true,
      onClose: () => {},
      onSubmit: () => {},
      initialData: {
        name: "Test API Availability",
        target: 99.95,
        window: "30d",
        evaluationInterval: "5m",
      },
    }),
  );

  assert.ok(clean(modalHtml).includes('role="dialog"'));
  assert.ok(clean(modalHtml).includes('aria-modal="true"'));
  assert.ok(clean(modalHtml).includes('aria-labelledby="slo-modal-title"'));
  assert.ok(clean(modalHtml).includes("Edit Service Level Objective"));
  assert.ok(clean(modalHtml).includes("Test API Availability"));
  assert.ok(clean(modalHtml).includes("99.95"));
  assert.ok(clean(modalHtml).includes("Allowable Downtime (30d window):"));
  assert.ok(clean(modalHtml).includes("21m 36s"));
});

// ----------------------------------------------------------------------------
// 11. API Client Integration & Contract Verification
// ----------------------------------------------------------------------------
test("API Client: Verifies all SLO client functions are exported and callable", () => {
  assert.equal(typeof slosApi.getSlos, "function");
  assert.equal(typeof slosApi.getSloById, "function");
  assert.equal(typeof slosApi.createSlo, "function");
  assert.equal(typeof slosApi.updateSlo, "function");
  assert.equal(typeof slosApi.deleteSlo, "function");
  assert.equal(typeof slosApi.getMonitorSlos, "function");
  assert.equal(typeof slosApi.triggerSloEvaluation, "function");
  assert.equal(typeof slosApi.getSloSnapshots, "function");
  assert.equal(typeof slosApi.getLatestSloSnapshot, "function");
  assert.equal(typeof slosApi.getSloAlertState, "function");
});
