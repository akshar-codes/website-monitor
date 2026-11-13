import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import mongoose from "mongoose";

import ServiceDependency from "../src/models/ServiceDependency.js";
import Monitor from "../src/models/Monitor.js";
import HealthCheck from "../src/models/HealthCheck.js";
import Incident from "../src/models/Incident.js";
import DeploymentEvent from "../src/models/DeploymentEvent.js";
import RegionalCheck from "../src/models/RegionalCheck.js";
import Activity from "../src/models/Activity.js";

import {
  normalizeFailureSignature,
  compareFailureSignatures,
  FAILURE_CATEGORIES,
} from "../src/utils/failureSignature.js";
import {
  extractEndpointIdentity,
  compareEndpointIdentities,
} from "../src/utils/endpointIdentity.js";
import {
  scoreCorrelationCandidate,
  CLASSIFICATIONS,
  SCORING_VERSION,
  HEURISTIC_DISCLAIMER,
} from "../src/services/correlationScoring.service.js";
import {
  correlateIncident,
  correlateMonitorOutage,
  resolveGraphRelationship,
} from "../src/services/correlation.service.js";
import correlationRoutes from "../src/routes/incident.routes.js";
import monitorRoutes from "../src/routes/monitor.routes.js";

// Setup test environment variables
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/site-watch-tests",
  COOKIE_SECRET: "test-cookie-secret-with-more-than-thirty-two-characters",
  SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
});

const userAId = "64b000000000000000000010";
const userBId = "64b000000000000000000020";

const monitorA_Frontend = "64b000000000000000000001";
const monitorA_Backend = "64b000000000000000000002";
const monitorA_Database = "64b000000000000000000003";
const monitorA_Unrelated = "64b000000000000000000004";
const monitorB_TenantB = "64b000000000000000000099";

const makeQueryChain = (result) => {
  const chain = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    distinct: () => Promise.resolve(result),
    lean: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
};

let server;
let baseUrl;

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Setup & Teardown
// ─────────────────────────────────────────────────────────────────────────────

before(async () => {
  Activity.create = async () => ({});
  Incident.findByIdAndUpdate = async () => ({});

  const app = express();
  app.use(express.json());

  // Injected test auth middleware
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === "Bearer user-b") {
      req.user = { _id: userBId, id: userBId, role: "user" };
    } else if (authHeader === "Bearer user-a") {
      req.user = { _id: userAId, id: userAId, role: "user" };
    }
    next();
  });

  app.use("/api/incidents", correlationRoutes);
  app.use("/api/monitors", monitorRoutes);

  // Global error handler
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  setTimeout(() => process.exit(0), 100);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Failure Signature Normalization & Compatibility Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Failure Signature: classifies HTTP 504 and 502 as gateway error symptoms", () => {
  const sig504 = normalizeFailureSignature({
    httpStatus: 504,
    responseTime: 5000,
  });
  assert.equal(sig504.category, FAILURE_CATEGORIES.HTTP_GATEWAY_ERROR);
  assert.equal(sig504.isGatewayError, true);
  assert.equal(sig504.isTimeout, true);

  const sig502 = normalizeFailureSignature({
    httpStatus: 502,
    responseTime: 250,
  });
  assert.equal(sig502.category, FAILURE_CATEGORIES.HTTP_GATEWAY_ERROR);
  assert.equal(sig502.isGatewayError, true);

  const sig500 = normalizeFailureSignature({ httpStatus: 500 });
  assert.equal(sig500.category, FAILURE_CATEGORIES.HTTP_SERVER_ERROR);
  assert.equal(sig500.isGatewayError, false);
});

test("Failure Signature: normalizes network timeouts, connection refused, and DNS errors", () => {
  const timeoutSig = normalizeFailureSignature({ failureReason: "timeout" });
  assert.equal(timeoutSig.category, FAILURE_CATEGORIES.TIMEOUT);
  assert.equal(timeoutSig.isTimeout, true);

  const connRefusedSig = normalizeFailureSignature({
    failureReason: "connection_refused",
  });
  assert.equal(connRefusedSig.category, FAILURE_CATEGORIES.CONNECTION_REFUSED);

  const dnsSig = normalizeFailureSignature({ failureReason: "dns_error" });
  assert.equal(dnsSig.category, FAILURE_CATEGORIES.DNS_ERROR);

  const missingSig = normalizeFailureSignature(null);
  assert.equal(missingSig.category, FAILURE_CATEGORIES.GENERIC_ERROR);
});

test("Failure Signature: calculates cascading compatibility between downstream timeout and upstream failure", () => {
  const downstreamTimeout = {
    isGatewayError: true,
    isTimeout: true,
    description: "HTTP 504",
  };
  const upstreamDown = {
    category: FAILURE_CATEGORIES.HTTP_SERVER_ERROR,
    description: "HTTP 500",
  };

  // Upstream dependency failed with 500 while downstream timed out with 504
  const result = compareFailureSignatures(
    downstreamTimeout,
    upstreamDown,
    true,
  );
  assert.equal(result.score, 15);
  assert.equal(result.matchType, "cascading_gateway_timeout");

  // Identical infrastructure failure (both connection refused)
  const connA = {
    category: FAILURE_CATEGORIES.CONNECTION_REFUSED,
    description: "ECONNREFUSED",
  };
  const connB = {
    category: FAILURE_CATEGORIES.CONNECTION_REFUSED,
    description: "ECONNREFUSED",
  };
  const identResult = compareFailureSignatures(connA, connB, false);
  assert.equal(identResult.score, 12);
  assert.equal(identResult.matchType, "identical_infrastructure_signature");

  // Contradictory / unrelated (401 client error)
  const clientError = {
    category: FAILURE_CATEGORIES.HTTP_CLIENT_ERROR,
    description: "HTTP 401",
  };
  const contraResult = compareFailureSignatures(
    clientError,
    upstreamDown,
    false,
  );
  assert.equal(contraResult.score, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Endpoint Identity & Proximity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Endpoint Identity: parses hostname and base domain reliably", () => {
  const m1 = { url: "https://orders.api.internal:8080/v1/checkout" };
  const id1 = extractEndpointIdentity(m1);
  assert.equal(id1.isAvailable, true);
  assert.equal(id1.host, "orders.api.internal");
  assert.equal(id1.baseDomain, "api.internal");

  const mNull = { url: null };
  const idNull = extractEndpointIdentity(mNull);
  assert.equal(idNull.isAvailable, false);
});

test("Endpoint Identity: rewards exact host match and shared domain cluster", () => {
  const idA = {
    host: "service.internal",
    baseDomain: "service.internal",
    isAvailable: true,
  };
  const idB = {
    host: "service.internal",
    baseDomain: "service.internal",
    isAvailable: true,
  };
  const idC = {
    host: "billing.internal",
    baseDomain: "billing.internal",
    isAvailable: true,
  };

  const exact = compareEndpointIdentities(idA, idB);
  assert.equal(exact.score, 10);
  assert.equal(exact.matchType, "exact_host");

  const distinct = compareEndpointIdentities(idA, idC);
  assert.equal(distinct.score, 0);
  assert.equal(distinct.matchType, "distinct_hosts");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Deterministic Candidate Scoring Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Scoring Engine: direct upstream failure preceding downstream by 45s yields high probable root cause (>= 75)", () => {
  const baseTime = Date.now();
  const targetIncident = {
    _id: "inc-target",
    startedAt: new Date(baseTime).toISOString(), // T = 0
    monitor: { name: "Checkout Web", url: "https://store.internal/checkout" },
    triggerCheckSnapshot: { httpStatus: 504, responseTime: 5000 },
  };

  const candidateIncident = {
    _id: "inc-candidate",
    startedAt: new Date(baseTime - 45000).toISOString(), // 45s earlier
    monitor: { name: "Payment Gateway", url: "https://pay.internal/charge" },
    triggerCheckSnapshot: { httpStatus: 500, responseTime: 400 },
  };

  const graphRelationship = {
    type: "direct_upstream",
    depth: 1,
    isHard: true,
    path: ["Checkout Web", "Payment Gateway"],
  };

  const scored = scoreCorrelationCandidate({
    targetIncident,
    candidateIncident,
    graphRelationship,
    candidatePreOutageChecks: [
      { responseTime: 80, checkedAt: new Date(baseTime - 120000) },
      { responseTime: 350, checkedAt: new Date(baseTime - 60000) },
    ],
  });

  // Expected signals: direct_upstream (40) + propagation_precedence (25) + cascading_gateway (15) + pre_outage_latency (10) = 90
  assert.ok(scored.score >= 75, `Expected score >= 75, got ${scored.score}`);
  assert.equal(scored.classification, CLASSIFICATIONS.PROBABLE_ROOT_CAUSE);
  assert.ok(
    scored.supportingSignals.some(
      (s) => s.signal === "direct_upstream_dependency",
    ),
  );
  assert.ok(
    scored.supportingSignals.some(
      (s) => s.signal === "temporal_propagation_precedence",
    ),
  );
  assert.equal(scored.scoringVersion, SCORING_VERSION);
  assert.match(scored.disclaimer, /ranking heuristic/);
});

test("Scoring Engine: reversed failure order (candidate failed AFTER target) incurs heavy penalty", () => {
  const baseTime = Date.now();
  const targetIncident = {
    _id: "inc-target",
    startedAt: new Date(baseTime).toISOString(), // T = 0
    monitor: { name: "Frontend App" },
    triggerCheckSnapshot: { httpStatus: 500 },
  };

  // Candidate failed 60 seconds AFTER the target outage was already underway!
  const candidateIncident = {
    _id: "inc-candidate",
    startedAt: new Date(baseTime + 60000).toISOString(),
    monitor: { name: "Analytics Collector" },
    triggerCheckSnapshot: { httpStatus: 500 },
  };

  const graphRelationship = {
    type: "direct_upstream",
    depth: 1,
    isHard: false,
    path: ["Frontend App", "Analytics Collector"],
  };

  const scored = scoreCorrelationCandidate({
    targetIncident,
    candidateIncident,
    graphRelationship,
  });

  // Check for reversed temporal order conflicting signal
  assert.ok(
    scored.conflictingSignals.some(
      (s) => s.signal === "reversed_temporal_order",
    ),
  );
  assert.ok(
    scored.score < 30,
    `Expected low score due to reversed timing, got ${scored.score}`,
  );
  assert.equal(scored.classification, CLASSIFICATIONS.UNLIKELY);
});

test("Scoring Engine: temporal-only coincidence without graph link yields low score (< 30)", () => {
  const baseTime = Date.now();
  const targetIncident = {
    _id: "inc-target",
    startedAt: new Date(baseTime).toISOString(),
    monitor: { name: "Customer Portal", url: "https://customers.com" },
    triggerCheckSnapshot: { failureReason: "timeout" },
  };

  // Coincidentally failed at the exact same time, but totally unrelated service/host
  const candidateIncident = {
    _id: "inc-candidate",
    startedAt: new Date(baseTime - 2000).toISOString(),
    monitor: {
      name: "Warehouse IoT Poller",
      url: "https://warehouse.internal",
    },
    triggerCheckSnapshot: { failureReason: "dns_error" },
  };

  const graphRelationship = {
    type: "none",
    depth: 0,
    isDirect: false,
    isHard: false,
    path: [],
  };

  const scored = scoreCorrelationCandidate({
    targetIncident,
    candidateIncident,
    graphRelationship,
  });

  assert.ok(
    scored.score < 30,
    `Expected score < 30 for temporal coincidence, got ${scored.score}`,
  );
  assert.equal(scored.classification, CLASSIFICATIONS.UNLIKELY);
  assert.ok(scored.missingSignals.includes("dependency_relationship"));
});

test("Scoring Engine: different-region failure incurs penalty", () => {
  const baseTime = Date.now();
  const targetIncident = {
    _id: "inc-target",
    startedAt: new Date(baseTime).toISOString(),
    monitor: { name: "US Web", url: "https://us.example.com" },
  };

  const candidateIncident = {
    _id: "inc-candidate",
    startedAt: new Date(baseTime - 30000).toISOString(),
    monitor: { name: "EU Web", url: "https://eu.example.com" },
  };

  const graphRelationship = {
    type: "shared_upstream",
    depth: 2,
    isHard: false,
  };

  // Target failed only in us-east, candidate failed only in eu-west
  const scored = scoreCorrelationCandidate({
    targetIncident,
    candidateIncident,
    graphRelationship,
    targetRegionalChecks: [{ regionId: "us-east", healthStatus: "down" }],
    candidateRegionalChecks: [{ regionId: "eu-west", healthStatus: "down" }],
  });

  assert.ok(
    scored.conflictingSignals.some((s) => s.signal === "disjoint_regions"),
  );
});

test("Scoring Engine: supports multiple competing candidates with deterministic ranking", () => {
  const baseTime = Date.now();
  const targetIncident = {
    _id: "inc-target",
    startedAt: new Date(baseTime).toISOString(),
    monitor: { name: "Storefront" },
    triggerCheckSnapshot: { httpStatus: 504 },
  };

  // Candidate 1: Direct hard dependency failed 20s prior
  const candidate1 = {
    _id: "cand-1",
    startedAt: new Date(baseTime - 20000).toISOString(),
    monitor: { name: "Auth Provider" },
    triggerCheckSnapshot: { httpStatus: 500 },
  };

  // Candidate 2: Indirect depth-2 dependency failed 50s prior
  const candidate2 = {
    _id: "cand-2",
    startedAt: new Date(baseTime - 50000).toISOString(),
    monitor: { name: "Main Database" },
    triggerCheckSnapshot: { failureReason: "timeout" },
  };

  const scored1 = scoreCorrelationCandidate({
    targetIncident,
    candidateIncident: candidate1,
    graphRelationship: {
      type: "direct_upstream",
      depth: 1,
      isHard: true,
      path: ["Storefront", "Auth Provider"],
    },
  });

  const scored2 = scoreCorrelationCandidate({
    targetIncident,
    candidateIncident: candidate2,
    graphRelationship: {
      type: "indirect_upstream",
      depth: 2,
      isHard: true,
      path: ["Storefront", "Auth", "Main Database"],
    },
  });

  assert.ok(
    scored1.score > scored2.score,
    `Direct candidate (${scored1.score}) should outrank indirect (${scored2.score})`,
  );
  assert.equal(scored1.classification, CLASSIFICATIONS.PROBABLE_ROOT_CAUSE);
  assert.equal(scored2.classification, CLASSIFICATIONS.LIKELY_CORRELATED);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Graph Path & Direction Resolution Helper Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Graph Resolution: resolves direct, indirect, shared, and reversed relationships correctly", () => {
  // A depends on B, B depends on C
  const dependencies = [
    {
      dependentMonitor: { _id: "nodeA", name: "Service A" },
      toType: "monitor",
      dependencyMonitor: { _id: "nodeB", name: "Service B" },
      dependencyType: "hard",
      enabled: true,
    },
    {
      dependentMonitor: { _id: "nodeB", name: "Service B" },
      toType: "monitor",
      dependencyMonitor: { _id: "nodeC", name: "Service C" },
      dependencyType: "hard",
      enabled: true,
    },
  ];

  // Helper build
  const outgoing = new Map();
  const incoming = new Map();

  for (const dep of dependencies) {
    const fromId = dep.dependentMonitor._id;
    const toId = dep.dependencyMonitor._id;
    if (!outgoing.has(fromId)) outgoing.set(fromId, []);
    outgoing.get(fromId).push({ toId, isHard: true });
    if (!incoming.has(toId)) incoming.set(toId, []);
    incoming.get(toId).push({ fromId, isHard: true });
  }

  const mockGraph = {
    getOutgoing: (id) => outgoing.get(String(id)) || [],
    getIncoming: (id) => incoming.get(String(id)) || [],
  };

  // Direct upstream: A -> B
  const relDirect = resolveGraphRelationship(mockGraph, "nodeA", "nodeB");
  assert.equal(relDirect.type, "direct_upstream");
  assert.equal(relDirect.depth, 1);

  // Indirect upstream: A -> B -> C
  const relIndirect = resolveGraphRelationship(mockGraph, "nodeA", "nodeC");
  assert.equal(relIndirect.type, "indirect_upstream");
  assert.equal(relIndirect.depth, 2);

  // Downstream dependent: B is asked about A (A depends on B -> B sees A as downstream)
  const relDownstream = resolveGraphRelationship(mockGraph, "nodeB", "nodeA");
  assert.equal(relDownstream.type, "downstream_dependent");

  // No relationship: C and unrelated
  const relNone = resolveGraphRelationship(mockGraph, "nodeC", "nodeUnknown");
  assert.equal(relNone.type, "none");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Integration Tests: API Contracts & Cross-Tenant Boundaries
// ─────────────────────────────────────────────────────────────────────────────

test("Correlation API: cross-tenant incident investigation is strictly rejected", async () => {
  const origFindById = Incident.findById;
  const origMonitorFind = Monitor.find;

  Incident.findById = () =>
    makeQueryChain({
      _id: new mongoose.Types.ObjectId("64b000000000000000000099"),
      monitor: {
        _id: new mongoose.Types.ObjectId(monitorB_TenantB),
        name: "Tenant B Service",
        owner: new mongoose.Types.ObjectId(userBId),
      },
      startedAt: new Date(),
    });

  // User A owns only monitorA_Frontend, NOT Tenant B's monitor
  Monitor.find = () =>
    makeQueryChain([{ _id: new mongoose.Types.ObjectId(monitorA_Frontend) }]);

  try {
    // Request sent by User A to investigate Tenant B's incident
    const res = await fetch(
      `${baseUrl}/api/incidents/64b000000000000000000099/correlation`,
      {
        headers: {
          authorization: "Bearer user-a",
          connection: "close",
        },
      },
    );

    // Tenant check should fail with 403 Forbidden
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /access/i);
  } finally {
    Incident.findById = origFindById;
    Monitor.find = origMonitorFind;
  }
});

test("Correlation API: returns explainable candidates, scoring version, and causality disclaimer", async () => {
  const baseTime = Date.now();
  const mockTargetIncident = {
    _id: new mongoose.Types.ObjectId("64b000000000000000000101"),
    monitor: {
      _id: new mongoose.Types.ObjectId(monitorA_Frontend),
      name: "Storefront Web",
      owner: new mongoose.Types.ObjectId(userAId),
      url: "https://store.internal/shop",
    },
    startedAt: new Date(baseTime),
    status: "ongoing",
    severity: "critical",
    triggerCheck: { httpStatus: 504, responseTime: 5000 },
  };

  const mockCandidateIncident = {
    _id: new mongoose.Types.ObjectId("64b000000000000000000102"),
    monitor: {
      _id: new mongoose.Types.ObjectId(monitorA_Backend),
      name: "API Gateway",
      owner: new mongoose.Types.ObjectId(userAId),
      url: "https://api.internal/v1",
    },
    startedAt: new Date(baseTime - 35000), // 35s earlier
    status: "ongoing",
    severity: "critical",
    triggerCheck: { httpStatus: 500, responseTime: 800 },
  };

  // Mock DB calls for integration test
  const origFindById = Incident.findById;
  const origFind = Incident.find;
  const origDepFind = ServiceDependency.find;
  const origMonitorFind = Monitor.find;
  const origHealthFind = HealthCheck.find;
  const origDeployFind = DeploymentEvent.find;
  const origRegionalFind = RegionalCheck.find;

  Incident.findById = () => makeQueryChain(mockTargetIncident);
  Incident.find = () => makeQueryChain([mockCandidateIncident]);
  Monitor.find = () =>
    makeQueryChain([
      { _id: new mongoose.Types.ObjectId(monitorA_Frontend) },
      { _id: new mongoose.Types.ObjectId(monitorA_Backend) },
      { _id: new mongoose.Types.ObjectId(monitorA_Database) },
    ]);

  ServiceDependency.find = () =>
    makeQueryChain([
      {
        dependentMonitor: { _id: monitorA_Frontend, name: "Storefront Web" },
        toType: "monitor",
        dependencyMonitor: { _id: monitorA_Backend, name: "API Gateway" },
        dependencyType: "hard",
        enabled: true,
      },
    ]);

  HealthCheck.find = () => makeQueryChain([]);
  DeploymentEvent.find = () => makeQueryChain([]);
  RegionalCheck.find = () => makeQueryChain([]);

  try {
    const res = await fetch(
      `${baseUrl}/api/incidents/64b000000000000000000101/correlation?lookbackMinutes=30`,
      {
        headers: {
          authorization: "Bearer user-a",
          connection: "close",
        },
      },
    );

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.scoringVersion, SCORING_VERSION);
    assert.match(body.data.disclaimer, /heuristic/);

    const candidates = body.data.candidates;
    assert.equal(candidates.length, 1);
    const top = candidates[0];
    assert.equal(top.candidateName, "API Gateway");
    assert.ok(top.score >= 75);
    assert.equal(top.classification, CLASSIFICATIONS.PROBABLE_ROOT_CAUSE);
    assert.ok(top.supportingSignals.length >= 2);
    assert.match(top.explanation, /API Gateway/);
  } finally {
    Incident.findById = origFindById;
    Incident.find = origFind;
    ServiceDependency.find = origDepFind;
    Monitor.find = origMonitorFind;
    HealthCheck.find = origHealthFind;
    DeploymentEvent.find = origDeployFind;
    RegionalCheck.find = origRegionalFind;
  }
});
