import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

import {
  HEALTH_STATE_PROPS,
  getHealthProps,
  formatFreshness,
  formatDirectionDescription,
  computeGraphLayout,
} from "../src/utils/dependencyFormat.js";

import * as dependenciesApi from "../src/services/api/dependencies.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));

let viteServer;
let DependencyGraphView;
let DependencyDetailPanel;
let DependencyFormModal;

test.before(async () => {
  viteServer = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: "custom",
  });

  const graphViewMod = await viteServer.ssrLoadModule(
    "./src/components/dependencies/DependencyGraphView.jsx",
  );
  DependencyGraphView = graphViewMod.default;

  const detailPanelMod = await viteServer.ssrLoadModule(
    "./src/components/dependencies/DependencyDetailPanel.jsx",
  );
  DependencyDetailPanel = detailPanelMod.default;

  const formModalMod = await viteServer.ssrLoadModule(
    "./src/components/dependencies/DependencyFormModal.jsx",
  );
  DependencyFormModal = formModalMod.default;
});

test.after(async () => {
  if (viteServer) {
    await viteServer.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Dependency Formatting & State Helpers
// ─────────────────────────────────────────────────────────────────────────────

test("Dependency Format: HEALTH_STATE_PROPS covers all required health states", () => {
  const states = [
    "healthy",
    "degraded",
    "unhealthy",
    "unknown",
    "stale",
    "disabled",
  ];
  for (const s of states) {
    assert.ok(HEALTH_STATE_PROPS[s], `Missing health prop definition for ${s}`);
    assert.ok(HEALTH_STATE_PROPS[s].label, `Missing label for ${s}`);
    assert.ok(
      HEALTH_STATE_PROPS[s].borderClass,
      `Missing borderClass for ${s}`,
    );
    assert.ok(HEALTH_STATE_PROPS[s].dotClass, `Missing dotClass for ${s}`);
  }
});

test("Dependency Format: getHealthProps returns correct configuration with fallback", () => {
  const healthy = getHealthProps("healthy");
  assert.equal(healthy.label, "Healthy");
  assert.match(healthy.textClass, /emerald/);

  const stale = getHealthProps("stale");
  assert.equal(stale.label, "Stale Data");
  assert.match(stale.textClass, /amber/);

  const fallback = getHealthProps("non-existent-state");
  assert.equal(fallback.label, "Unknown");
});

test("Dependency Format: formatFreshness formats timestamps and relative times", () => {
  assert.equal(formatFreshness(null), "No checks recorded");
  assert.equal(formatFreshness(undefined), "No checks recorded");

  const now = new Date();
  assert.equal(formatFreshness(now.toISOString()), "Just now");

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  assert.equal(formatFreshness(tenMinutesAgo), "10m ago");

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assert.equal(formatFreshness(twoHoursAgo), "2h ago");

  const twoDaysAgo = new Date(
    Date.now() - 2 * 24 * 60 * 60 * 1000,
  ).toISOString();
  assert.equal(formatFreshness(twoDaysAgo), "2d ago");
});

test("Dependency Format: formatDirectionDescription enforces A -> B semantics", () => {
  const desc = formatDirectionDescription("Frontend Web", "API Gateway");
  assert.match(desc, /Frontend Web.*depends on.*API Gateway/);

  const fallbackDesc = formatDirectionDescription();
  assert.match(fallbackDesc, /Source depends on Target/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Topological Graph Layout Engine
// ─────────────────────────────────────────────────────────────────────────────

test("Graph Layout: empty nodes return empty layout and default dimensions", () => {
  const { layoutNodes, layoutEdges, bounds } = computeGraphLayout([], []);
  assert.equal(layoutNodes.length, 0);
  assert.equal(layoutEdges.length, 0);
  assert.ok(bounds.width > 0);
  assert.ok(bounds.height > 0);
});

test("Graph Layout: assigns distinct coordinates in multi-tier dependency chain", () => {
  // A -> B -> C (A depends on B, B depends on C)
  const nodes = [
    { id: "A", name: "Frontend", type: "monitor" },
    { id: "B", name: "Backend API", type: "monitor" },
    { id: "C", name: "PostgreSQL Database", type: "external_service" },
  ];
  const edges = [
    { id: "e1", from: "A", to: "B", dependencyType: "hard", enabled: true },
    { id: "e2", from: "B", to: "C", dependencyType: "hard", enabled: true },
  ];

  const { layoutNodes, layoutEdges } = computeGraphLayout(nodes, edges);

  assert.equal(layoutNodes.length, 3);
  assert.equal(layoutEdges.length, 2);

  const nodeA = layoutNodes.find((n) => n.id === "A");
  const nodeB = layoutNodes.find((n) => n.id === "B");
  const nodeC = layoutNodes.find((n) => n.id === "C");

  assert.ok(nodeA.x !== undefined && nodeA.y !== undefined);
  assert.ok(nodeB.x !== undefined && nodeB.y !== undefined);
  assert.ok(nodeC.x !== undefined && nodeC.y !== undefined);

  // Left-to-right flow: A should be to the left of B, B to the left of C
  assert.ok(
    nodeA.x < nodeB.x,
    `Expected Node A (x: ${nodeA.x}) < Node B (x: ${nodeB.x})`,
  );
  assert.ok(
    nodeB.x < nodeC.x,
    `Expected Node B (x: ${nodeB.x}) < Node C (x: ${nodeC.x})`,
  );

  // Edge layout should contain source and target coordinate paths
  const edge1 = layoutEdges.find((e) => e.id === "e1");
  assert.ok(edge1.path.startsWith("M"));
  assert.ok(edge1.sourceX < edge1.targetX);
});

test("Graph Layout: handles diamond topology without node overlap", () => {
  // A -> B, A -> C, B -> D, C -> D
  const nodes = [
    { id: "A", name: "Edge Router" },
    { id: "B", name: "Auth Service" },
    { id: "C", name: "Billing Service" },
    { id: "D", name: "Database Cluster" },
  ];
  const edges = [
    { id: "e1", from: "A", to: "B" },
    { id: "e2", from: "A", to: "C" },
    { id: "e3", from: "B", to: "D" },
    { id: "e4", from: "C", to: "D" },
  ];

  const { layoutNodes } = computeGraphLayout(nodes, edges);
  const nodeB = layoutNodes.find((n) => n.id === "B");
  const nodeC = layoutNodes.find((n) => n.id === "C");

  // B and C are in the same layer rank (layer 1) but must have distinct Y positions
  assert.equal(nodeB.x, nodeC.x);
  assert.notEqual(nodeB.y, nodeC.y);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. API Contract Exports
// ─────────────────────────────────────────────────────────────────────────────

test("API Client: exports all required Phase 1 & 2 dependency functions", () => {
  assert.equal(typeof dependenciesApi.getDependencyGraph, "function");
  assert.equal(typeof dependenciesApi.getDependencies, "function");
  assert.equal(typeof dependenciesApi.getMonitorDependencies, "function");
  assert.equal(typeof dependenciesApi.createDependency, "function");
  assert.equal(typeof dependenciesApi.validateProposedDependency, "function");
  assert.equal(typeof dependenciesApi.updateDependency, "function");
  assert.equal(typeof dependenciesApi.deleteDependency, "function");
  assert.equal(typeof dependenciesApi.getExternalServices, "function");
  assert.equal(typeof dependenciesApi.createExternalService, "function");
  assert.equal(typeof dependenciesApi.deleteExternalService, "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Component SSR Rendering: DependencyGraphView
// ─────────────────────────────────────────────────────────────────────────────

test("DependencyGraphView Component: renders empty state when no nodes exist", () => {
  const html = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(DependencyGraphView, {
        nodes: [],
        edges: [],
        onAddDependency: () => {},
      }),
    ),
  );

  assert.match(html, /No services or dependencies mapped yet/);
  assert.match(html, /Add First Dependency/);
  assert.match(html, /data-testid="add-first-dependency"/);
});

test("DependencyGraphView Component: renders SVG canvas with nodes, directed edges, and active outage indicators", () => {
  const nodes = [
    {
      id: "node-1",
      name: "Checkout Frontend",
      type: "monitor",
      kind: "http",
      health: {
        state: "healthy",
        statusCode: 200,
        responseTime: 85,
        checkedAt: new Date().toISOString(),
        activeIncidentsCount: 0,
      },
    },
    {
      id: "node-2",
      name: "Payment Gateway API",
      type: "external_service",
      kind: "payment_gateway",
      health: {
        state: "unhealthy",
        statusCode: 503,
        responseTime: 1450,
        checkedAt: new Date().toISOString(),
        activeIncidentsCount: 1,
        activeIncidentId: "inc-99",
      },
    },
  ];

  const edges = [
    {
      id: "edge-1",
      from: "node-1",
      to: "node-2",
      dependencyType: "hard",
      description: "Processes credit card transactions",
      enabled: true,
    },
  ];

  const html = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(DependencyGraphView, {
        nodes,
        edges,
        selectedNodeId: "node-1",
      }),
    ),
  );

  // SVG Elements and directed arrow markers
  assert.match(html, /<svg/);
  assert.match(html, /id="arrow-marker"/);
  assert.match(html, /id="arrow-marker-selected"/);
  assert.match(html, /marker-end="url\(#arrow-marker/);

  // Node details
  assert.match(html, /Checkout Frontend/);
  assert.match(html, /Payment Gateway API/);
  assert.match(html, /85.*ms/);

  // Outage badge on unhealthy node
  assert.match(html, /OUTAGE/);

  // Search & Filter controls
  assert.match(html, /placeholder="Search services\.\.\."/);
  assert.match(html, /All Health States/);
  assert.match(html, /Active Incidents Only/);
  assert.match(html, /Hard \/ Soft/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Component SSR Rendering: DependencyDetailPanel
// ─────────────────────────────────────────────────────────────────────────────

test("DependencyDetailPanel Component: renders comprehensive node diagnostics and upstream/downstream lists", () => {
  const selectedNode = {
    id: "mon-api",
    name: "Orders Service",
    type: "monitor",
    kind: "http",
    url: "https://orders.example.com",
    health: {
      state: "degraded",
      statusCode: 504,
      responseTime: 890,
      checkedAt: new Date().toISOString(),
      activeIncidentsCount: 1,
      activeIncidentId: "inc-101",
      errorMessage: "Gateway timeout on checkout RPC",
    },
  };

  const allNodes = [
    selectedNode,
    {
      id: "ext-db",
      name: "Orders Postgres RDS",
      type: "external_service",
      kind: "database",
      health: { state: "healthy" },
    },
    {
      id: "mon-web",
      name: "Web Portal",
      type: "monitor",
      kind: "http",
      health: { state: "healthy" },
    },
  ];

  const allEdges = [
    // Upstream: Orders Service depends on DB
    {
      id: "edge-upstream",
      from: "mon-api",
      to: "ext-db",
      dependencyType: "hard",
      description: "Primary database store",
      enabled: true,
    },
    // Downstream: Web Portal depends on Orders Service
    {
      id: "edge-downstream",
      from: "mon-web",
      to: "mon-api",
      dependencyType: "soft",
      description: "Optional storefront catalog integration",
      enabled: true,
    },
  ];

  const html = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(DependencyDetailPanel, {
        node: selectedNode,
        allNodes,
        allEdges,
        onClose: () => {},
        onSelectNode: () => {},
        onAddDependency: () => {},
        onEditDependency: () => {},
        onDeleteDependency: () => {},
        onToggleDependency: () => {},
      }),
    ),
  );

  // Service Name & Kind
  assert.match(html, /Orders Service/);
  assert.match(html, /https:\/\/orders\.example\.com/);
  assert.match(html, /Degraded/);
  assert.match(html, /HTTP.*504/);
  assert.match(html, /890 ms/);
  assert.match(html, /Gateway timeout on checkout RPC/);

  // Active Outage Card
  assert.match(html, /Active Outage.*1/);
  assert.match(html, /href="\/incidents\/inc-101"/);

  // Upstream section
  assert.match(html, /Depends On \(Upstream\)/);
  assert.match(html, /Orders Postgres RDS/);
  assert.match(html, /Primary database store/);

  // Downstream section
  assert.match(html, /Dependents \(Downstream\)/);
  assert.match(html, /Web Portal/);

  // Direct link to Monitor Details page
  assert.match(html, /href="\/monitors\/mon-api"/);
  assert.match(html, /Monitor Details/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Component SSR Rendering: DependencyFormModal
// ─────────────────────────────────────────────────────────────────────────────

test("DependencyFormModal Component: renders accessible modal with relationship options", () => {
  const monitors = [
    { id: "mon-1", name: "Frontend Client", url: "https://app.example.com" },
    { id: "mon-2", name: "Auth Service", url: "https://auth.example.com" },
  ];
  const externalServices = [
    { id: "ext-1", name: "Stripe Billing", kind: "payment_gateway" },
  ];

  const html = renderToString(
    React.createElement(DependencyFormModal, {
      open: true,
      onClose: () => {},
      onSubmit: async () => {},
      monitors,
      externalServices,
      existingEdges: [],
    }),
  );

  // Dialog Accessibility
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /id="dependency-modal-title"/);

  // Direction explanation
  assert.match(html, /Source \(Caller\)/);
  assert.match(html, /Target \(Dependency\)/);

  // Form Fields
  assert.match(html, /1\. Dependent Service \(Caller \/ Source\)/);
  assert.match(html, /2\. Depends On \(Target Service\)/);
  assert.match(html, /3\. Dependency Strength/);
  assert.match(html, /Hard Dependency/);
  assert.match(html, /Soft Dependency/);
  assert.match(html, /Frontend Client/);
  assert.match(html, /Create Dependency/);
});
