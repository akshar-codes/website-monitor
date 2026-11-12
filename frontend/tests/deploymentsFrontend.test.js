import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

import {
  shortCommitSha,
  getEnvironmentBadgeStyle,
  mapDeploymentsToChart,
} from "../src/utils/deploymentFormat.js";

import * as deploymentsApi from "../src/services/api/deployments.js";

let viteServer;
let DeploymentTimeline;
let DeploymentDetailModal;

test.before(async () => {
  viteServer = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  const timelineMod = await viteServer.ssrLoadModule(
    "./src/components/deployments/DeploymentTimeline.jsx",
  );
  DeploymentTimeline = timelineMod.default;

  const modalMod = await viteServer.ssrLoadModule(
    "./src/components/deployments/DeploymentDetailModal.jsx",
  );
  DeploymentDetailModal = modalMod.default;
});

test.after(async () => {
  if (viteServer) {
    await viteServer.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Utilities & Formatters
// ─────────────────────────────────────────────────────────────────────────────

test("Deployment Formatting: shortCommitSha handles lengths and missing values", () => {
  assert.equal(shortCommitSha("0123456789abcdef"), "0123456");
  assert.equal(shortCommitSha("12345"), "12345");
  assert.equal(shortCommitSha(null), null);
  assert.equal(shortCommitSha(undefined), null);
  assert.equal(shortCommitSha(""), null);
});

test("Deployment Formatting: getEnvironmentBadgeStyle maps environments", () => {
  const prod = getEnvironmentBadgeStyle("production");
  assert.match(prod.badgeClass, /emerald/);
  assert.equal(prod.label, "Production");

  const stage = getEnvironmentBadgeStyle("staging");
  assert.match(stage.badgeClass, /amber/);
  assert.equal(stage.label, "Staging");

  const dev = getEnvironmentBadgeStyle("development");
  assert.match(dev.badgeClass, /blue/);
  assert.equal(dev.label, "Development");

  const custom = getEnvironmentBadgeStyle("qa-env");
  assert.match(custom.badgeClass, /slate/);
  assert.equal(custom.label, "qa-env");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Chart Bucket Mapping & Boundary Safeguards
// ─────────────────────────────────────────────────────────────────────────────

test("Chart Mapping: groups multiple deployments in the same bucket without distortion", () => {
  const baseTime = new Date("2026-11-12T10:00:00.000Z").getTime();
  const chartPoints = [
    { timestamp: new Date(baseTime).toISOString() },
    { timestamp: new Date(baseTime + 3600000).toISOString() },
    { timestamp: new Date(baseTime + 7200000).toISOString() },
  ];

  const chart = chartPoints.map((p) => ({
    day: new Date(p.timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
    }),
    uptime: 100,
    response: 150,
  }));

  const deployments = [
    {
      id: "dep-1",
      version: "v1.0.1",
      environment: "production",
      deployedAt: new Date(baseTime + 600000).toISOString(), // 10:10 -> Bucket 0
    },
    {
      id: "dep-2",
      version: "v1.0.2",
      environment: "staging",
      deployedAt: new Date(baseTime + 1200000).toISOString(), // 10:20 -> Bucket 0
    },
    {
      id: "dep-3",
      version: "v1.1.0",
      environment: "production",
      deployedAt: new Date(baseTime + 3900000).toISOString(), // 11:05 -> Bucket 1
    },
    {
      id: "dep-outside",
      version: "v0.9.0",
      environment: "production",
      deployedAt: new Date(baseTime - 86400000).toISOString(), // Yesterday -> outside range
    },
  ];

  const { markers, bucketDeploymentsMap } = mapDeploymentsToChart(
    deployments,
    chart,
    chartPoints,
    "24h",
  );

  // Markers should only exist for buckets within range (Bucket 0 and Bucket 1)
  assert.equal(markers.length, 2);

  // Bucket 0 should contain 2 deployments
  const bucket0 = markers.find((m) => m.day === chart[0].day);
  assert.ok(bucket0, "Bucket 0 marker must exist");
  assert.equal(bucket0.count, 2);
  assert.equal(bucket0.deployments.length, 2);

  // Bucket 1 should contain 1 deployment
  const bucket1 = markers.find((m) => m.day === chart[1].day);
  assert.ok(bucket1, "Bucket 1 marker must exist");
  assert.equal(bucket1.count, 1);

  // Out of range deployment must not create an extra marker or distort chart
  assert.equal(bucketDeploymentsMap.size, 2);
  const allChartDays = new Set(chart.map((c) => c.day));
  for (const marker of markers) {
    assert.ok(
      allChartDays.has(marker.day),
      "Marker day must be in chart XAxis",
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Component SSR Rendering
// ─────────────────────────────────────────────────────────────────────────────

test("DeploymentTimeline Component: renders empty state when no deployments exist", () => {
  const html = renderToString(
    React.createElement(DeploymentTimeline, {
      deployments: [],
      window: "24h",
    }),
  );

  assert.match(html, /No deployments in this time window/);
  assert.match(html, /data-testid="deployment-timeline"/);
  assert.match(html, /data-testid="deployment-env-filter"/);
});

test("DeploymentTimeline Component: renders populated deployment list with metadata", () => {
  const deployments = [
    {
      id: "dep-prod-1",
      version: "v3.2.0",
      commitSha: "a1b2c3d4e5f6",
      environment: "production",
      deployedAt: new Date().toISOString(),
      source: "github-actions",
      description: "Optimized database index and caching layer",
    },
  ];

  const html = renderToString(
    React.createElement(DeploymentTimeline, {
      deployments,
      window: "24h",
    }),
  );

  assert.match(html, /v3\.2\.0/);
  assert.match(html, /Production/);
  assert.match(html, /a1b2c3d/);
  assert.match(html, /Optimized database index/);
  assert.match(html, /github-actions/);
  assert.match(html, /data-testid="focus-chart-button"/);
  assert.match(html, /data-testid="inspect-release-button"/);
});

test("DeploymentDetailModal Component: renders accessible release details dialog", () => {
  const deployment = {
    id: "dep-prod-1",
    version: "v3.2.0",
    commitSha: "a1b2c3d4e5f6",
    environment: "production",
    deployedAt: new Date().toISOString(),
    source: "github-actions",
    url: "https://ci.example.com/build/123",
    description: "Full release notes for v3.2.0",
    monitors: ["64b000000000000000000001"],
  };

  const html = renderToString(
    React.createElement(DeploymentDetailModal, {
      open: true,
      onClose: () => {},
      deployment,
    }),
  );

  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-labelledby="deployment-modal-title"/);
  assert.match(html, /v3\.2\.0/);
  assert.match(html, /https:\/\/ci\.example\.com\/build\/123/);
  assert.match(html, /Full release notes for v3\.2\.0/);
  assert.match(html, /Associated with/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. API Client Export Verification
// ─────────────────────────────────────────────────────────────────────────────

test("API Client: verifies all deployment API client functions are exported", () => {
  assert.equal(typeof deploymentsApi.getMonitorDeployments, "function");
  assert.equal(typeof deploymentsApi.getMonitorDeploymentById, "function");
  assert.equal(typeof deploymentsApi.getDeployments, "function");
  assert.equal(typeof deploymentsApi.getDeploymentIntegrations, "function");
});
