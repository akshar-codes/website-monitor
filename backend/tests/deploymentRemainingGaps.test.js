import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createHmac, createHash } from "node:crypto";

import env from "../src/config/env.js";
import { ROLES, PLANS } from "../src/config/constants.js";
import {
  generateDeploymentSecret,
  rotateDeploymentSecret,
  recordDeploymentEvent,
} from "../src/services/deployment.service.js";
import {
  evaluateDeploymentRegression,
  evaluatePendingDeploymentRegressions,
  NOTIFICATION_RETRY_CONFIG,
} from "../src/services/deploymentRegression.service.js";
import { reconcileDeploymentAlertDuplicates } from "../src/migrations/reconcileDeploymentAlertDuplicates.js";
import DeploymentAlertState, {
  NOTIFICATION_STATES,
  REGRESSION_STATUSES,
  REGRESSION_TYPES,
} from "../src/models/DeploymentAlertState.js";
import DeploymentEvent from "../src/models/DeploymentEvent.js";
import {
  rotateDeploymentSecretSchema,
  ingestDeploymentEventSchema,
} from "../src/validators/deployment.validator.js";

env.ALERT_CREDENTIAL_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const userAId = "64b0000000000000000000a1";
const monitorAId = "64b000000000000000000001";
const monitorBId = "64b000000000000000000002";
const deploymentAId = "64b0000000000000000000d1";

// ─────────────────────────────────────────────────────────────────────────────
// Gap 1: Reconcile Duplicate Alert States Migration
// ─────────────────────────────────────────────────────────────────────────────
test("Gap 1 (P1): reconcileDeploymentAlertDuplicates merges legacy duplicates and creates unique index", async () => {
  const depId = new mongoose.Types.ObjectId();
  const monId = new mongoose.Types.ObjectId();

  const doc1 = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    deployment: depId,
    monitor: monId,
    status: REGRESSION_STATUSES.EVALUATING,
    regressionType: REGRESSION_TYPES.LATENCY,
    evidence: ["Evidence latency line 1"],
    relatedIncidents: [new mongoose.Types.ObjectId()],
    notificationHistory: [
      {
        attemptedAt: new Date(Date.now() - 30000),
        state: NOTIFICATION_STATES.FAILED,
        error: "timeout",
      },
    ],
    alertDispatchedAt: null,
    cooldownUntil: null,
    notificationState: NOTIFICATION_STATES.FAILED,
    notificationAttempts: 1,
    lastEvaluatedAt: new Date(Date.now() - 20000),
  };

  const doc2 = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    deployment: depId,
    monitor: monId,
    status: REGRESSION_STATUSES.SUSPECTED_REGRESSION,
    regressionType: REGRESSION_TYPES.COMBINED,
    evidence: ["Evidence failure line 2"],
    relatedIncidents: [new mongoose.Types.ObjectId()],
    notificationHistory: [
      {
        attemptedAt: new Date(Date.now() - 10000),
        state: NOTIFICATION_STATES.SENT,
        error: null,
      },
    ],
    alertDispatchedAt: new Date(Date.now() - 10000),
    cooldownUntil: new Date(Date.now() + 50 * 60 * 1000),
    notificationState: NOTIFICATION_STATES.SENT,
    notificationAttempts: 1,
    lastEvaluatedAt: new Date(Date.now() - 5000), // Newer!
  };

  const store = new Map();
  store.set(doc1._id.toString(), { ...doc1 });
  store.set(doc2._id.toString(), { ...doc2 });

  let updatedCanonical = null;
  let deletedIds = [];
  let indexCreated = false;

  const mockModel = {
    aggregate: async () => [
      {
        _id: { deployment: depId, monitor: monId },
        count: 2,
        docIds: [doc1._id, doc2._id],
      },
    ],
    find: (filter) => ({
      lean: async () => {
        const ids = filter._id.$in.map((id) => id.toString());
        return ids.map((id) => store.get(id)).filter(Boolean);
      },
    }),
    updateOne: async (filter, update) => {
      updatedCanonical = {
        _id: filter._id,
        ...update.$set,
      };
      return { modifiedCount: 1 };
    },
    deleteMany: async (filter) => {
      deletedIds = filter._id.$in.map((id) => id.toString());
      return { deletedCount: deletedIds.length };
    },
    collection: {
      createIndex: async (fields, opts) => {
        if (fields.deployment === 1 && fields.monitor === 1 && opts.unique) {
          indexCreated = true;
        }
      },
    },
  };

  const result = await reconcileDeploymentAlertDuplicates({
    DeploymentAlertState: mockModel,
    force: true,
  });

  assert.equal(result.reconciledGroups, 1);
  assert.equal(result.deletedDuplicates, 1);
  assert.equal(deletedIds.length, 1);
  assert.equal(deletedIds[0], doc1._id.toString(), "Older doc must be deleted");
  assert.equal(
    updatedCanonical._id.toString(),
    doc2._id.toString(),
    "Newer doc must be canonical",
  );
  assert.equal(
    updatedCanonical.status,
    REGRESSION_STATUSES.SUSPECTED_REGRESSION,
  );
  assert.equal(
    updatedCanonical.evidence.length,
    2,
    "Evidence lines must be merged",
  );
  assert.equal(
    updatedCanonical.relatedIncidents.length,
    2,
    "Incident IDs must be combined",
  );
  assert.equal(
    updatedCanonical.notificationHistory.length,
    2,
    "Notification history must be combined",
  );
  assert.equal(updatedCanonical.notificationState, NOTIFICATION_STATES.SENT);
  assert.ok(indexCreated, "Unique index must be created");
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap 2: Deployment Idempotency Includes Monitor Scope & Integration Scope
// ─────────────────────────────────────────────────────────────────────────────
test("Gap 2 (P1): Fallback idempotency key includes monitor scope and integration scoping", async () => {
  const integrationA = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    environment: "production",
    monitors: [],
  };

  const origMonitorFind = mongoose.model("Monitor").find;
  const origDeploymentFindOne = mongoose.model("DeploymentEvent").findOne;
  const origDeploymentCreate = mongoose.model("DeploymentEvent").create;

  const createdEvents = [];

  mongoose.model("Monitor").find = (query) => ({
    select: async () => {
      const ids = query._id.$in.map(String);
      return ids.map((id) => ({
        _id: new mongoose.Types.ObjectId(id),
        owner: new mongoose.Types.ObjectId(userAId),
        name: `Monitor ${id}`,
      }));
    },
  });

  mongoose.model("DeploymentEvent").findOne = async (query) => {
    // Check if duplicate matches existing in same integration
    const match = createdEvents.find((e) => {
      if (e.owner.toString() !== query.owner.toString()) return false;
      if (e.integration.toString() !== query.integration.toString())
        return false;
      return query.$or?.some(
        (c) =>
          (c.externalId && c.externalId === e.externalId) ||
          (c.idempotencyKey && c.idempotencyKey === e.idempotencyKey),
      );
    });
    return match ? { toJSON: () => match } : null;
  };

  mongoose.model("DeploymentEvent").create = async (doc) => {
    createdEvents.push(doc);
    return {
      toJSON: () => ({ id: `event-${createdEvents.length}`, ...doc }),
    };
  };

  try {
    const fixedDate = new Date();

    // Release 1: targeting Monitor A
    const res1 = await recordDeploymentEvent({
      integration: integrationA,
      payload: {
        monitors: [monitorAId],
        version: "v1.0.0",
        commitSha: "sha-abc",
        deployedAt: fixedDate,
      },
    });

    // Release 2: targeting Monitor B in the SAME minute with SAME version and commit
    const res2 = await recordDeploymentEvent({
      integration: integrationA,
      payload: {
        monitors: [monitorBId],
        version: "v1.0.0",
        commitSha: "sha-abc",
        deployedAt: fixedDate,
      },
    });

    assert.equal(res1.isDuplicate, false);
    assert.equal(
      res2.isDuplicate,
      false,
      "Release to different monitor must NOT be treated as duplicate",
    );
    assert.notEqual(
      createdEvents[0].idempotencyKey,
      createdEvents[1].idempotencyKey,
      "Fingerprints must differ because monitor scopes differ",
    );

    // Release 3: retry Release 1 with identical Monitor A -> DUPLICATE!
    const res3 = await recordDeploymentEvent({
      integration: integrationA,
      payload: {
        monitors: [monitorAId],
        version: "v1.0.0",
        commitSha: "sha-abc",
        deployedAt: fixedDate,
      },
    });

    assert.equal(
      res3.isDuplicate,
      true,
      "Exact same monitor and release retry must be deduplicated",
    );
  } finally {
    mongoose.model("Monitor").find = origMonitorFind;
    mongoose.model("DeploymentEvent").findOne = origDeploymentFindOne;
    mongoose.model("DeploymentEvent").create = origDeploymentCreate;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap 3: Regression Worker Chronological Pagination & Durable State Filtering
// ─────────────────────────────────────────────────────────────────────────────
test("Gap 3 (P2): evaluatePendingDeploymentRegressions paginates chronologically and skips finalized windows", async () => {
  const evaluatedDeployments = [];

  // Create 3 mock deployments:
  // dep1: 60 mins ago (finalized) -> should be skipped!
  // dep2: 15 mins ago (evaluating) -> should be evaluated!
  // dep3: 5 mins ago (new) -> should be evaluated!
  const dep1 = {
    _id: new mongoose.Types.ObjectId(),
    monitors: [new mongoose.Types.ObjectId(monitorAId)],
    deployedAt: new Date(Date.now() - 60 * 60 * 1000),
  };
  const dep2 = {
    _id: new mongoose.Types.ObjectId(),
    monitors: [new mongoose.Types.ObjectId(monitorAId)],
    deployedAt: new Date(Date.now() - 15 * 60 * 1000),
  };
  const dep3 = {
    _id: new mongoose.Types.ObjectId(),
    monitors: [new mongoose.Types.ObjectId(monitorAId)],
    deployedAt: new Date(Date.now() - 5 * 60 * 1000),
  };

  const mockDeps = {
    DeploymentEvent: {
      find: () => ({
        select: () => ({
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => [dep1, dep2, dep3],
              }),
            }),
          }),
        }),
      }),
      findOne: (query) => ({
        lean: async () => {
          const found = [dep1, dep2, dep3].find(
            (d) => d._id.toString() === query._id.toString(),
          );
          if (found) {
            evaluatedDeployments.push(found._id.toString());
            return {
              ...found,
              owner: new mongoose.Types.ObjectId(userAId),
              version: "v1.0.0",
            };
          }
          return null;
        },
      }),
      findById: (id) => ({
        lean: async () => {
          const found = [dep1, dep2, dep3].find(
            (d) => d._id.toString() === id.toString(),
          );
          if (found) {
            evaluatedDeployments.push(found._id.toString());
            return {
              ...found,
              owner: new mongoose.Types.ObjectId(userAId),
              version: "v1.0.0",
            };
          }
          return null;
        },
      }),
    },
    DeploymentAlertState: {
      findOne: (query) => ({
        select: () => ({
          lean: async () => {
            if (query.deployment.toString() === dep1._id.toString()) {
              // Finalized normal state after 30m window elapsed
              return {
                status: REGRESSION_STATUSES.NORMAL,
                notificationState: NOTIFICATION_STATES.IDLE,
              };
            }
            if (query.deployment.toString() === dep2._id.toString()) {
              // Incomplete evaluating state
              return {
                status: REGRESSION_STATUSES.EVALUATING,
                notificationState: NOTIFICATION_STATES.IDLE,
              };
            }
            return null; // dep3 not yet evaluated
          },
        }),
      }),
      findOneAndUpdate: async () => ({
        alertDispatchedAt: null,
        notificationState: NOTIFICATION_STATES.IDLE,
      }),
    },
    Monitor: {
      findOne: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(monitorAId),
          owner: new mongoose.Types.ObjectId(userAId),
        }),
      }),
      findById: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(monitorAId),
          owner: new mongoose.Types.ObjectId(userAId),
        }),
      }),
    },
    HealthCheck: {
      find: () => ({
        select: () => ({ sort: () => ({ lean: async () => [] }) }),
      }),
    },
    Incident: {
      find: () => ({
        select: () => ({ sort: () => ({ lean: async () => [] }) }),
      }),
    },
    isInternal: true,
  };

  // Mock evaluateDeploymentRegression to track which deployments were evaluated
  const origFindOneDep = mongoose.model("DeploymentEvent").findOne;
  mongoose.model("DeploymentEvent").findOne = (query) => ({
    lean: async () => {
      const found = [dep1, dep2, dep3].find(
        (d) => d._id.toString() === query._id.toString(),
      );
      if (found) {
        evaluatedDeployments.push(found._id.toString());
        return {
          ...found,
          owner: new mongoose.Types.ObjectId(userAId),
          version: "v1.0.0",
        };
      }
      return null;
    },
  });

  try {
    const sweep = await evaluatePendingDeploymentRegressions(
      { batchSize: 25 },
      mockDeps,
    );

    assert.equal(
      sweep.evaluatedCount,
      2,
      "Only pending/evaluating deployments should be evaluated",
    );
    assert.ok(
      !evaluatedDeployments.includes(dep1._id.toString()),
      "dep1 (finalized) must be skipped",
    );
    assert.ok(
      evaluatedDeployments.includes(dep2._id.toString()),
      "dep2 (evaluating) must be evaluated",
    );
    assert.ok(
      evaluatedDeployments.includes(dep3._id.toString()),
      "dep3 (new) must be evaluated",
    );
  } finally {
    mongoose.model("DeploymentEvent").findOne = origFindOneDep;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap 4: Notification Retry Exponential Backoff & Max Retry Policy
// ─────────────────────────────────────────────────────────────────────────────
test("Gap 4 (P2): Notification failure applies exponential backoff and enforces max retry policy", async () => {
  const monitor = {
    _id: new mongoose.Types.ObjectId(monitorAId),
    name: "API Monitor",
    owner: new mongoose.Types.ObjectId(userAId),
  };

  const deployment = {
    _id: new mongoose.Types.ObjectId(deploymentAId),
    owner: new mongoose.Types.ObjectId(userAId),
    version: "v1.0.0",
    monitors: [monitor._id],
    deployedAt: new Date(Date.now() - 35 * 60 * 1000),
  };

  const checks = [
    {
      status: "up",
      responseTime: 50,
      checkedAt: new Date(Date.now() - 40 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 50,
      checkedAt: new Date(Date.now() - 38 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 50,
      checkedAt: new Date(Date.now() - 36 * 60 * 1000),
      scheduled: true,
    },
  ];
  const postChecks = [
    {
      status: "up",
      responseTime: 150,
      checkedAt: new Date(Date.now() - 30 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 160,
      checkedAt: new Date(Date.now() - 25 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 170,
      checkedAt: new Date(Date.now() - 20 * 60 * 1000),
      scheduled: true,
    },
  ];

  let alertDoc = {
    _id: new mongoose.Types.ObjectId(),
    owner: monitor.owner,
    monitor: monitor._id,
    deployment: deployment._id,
    notificationAttempts: 0,
    notificationState: NOTIFICATION_STATES.IDLE,
    maxNotificationAttempts: 5,
  };

  const mockDeps = {
    Monitor: {
      findOne: () => ({ lean: async () => monitor }),
      findById: () => ({ lean: async () => monitor }),
    },
    DeploymentEvent: {
      findOne: () => ({ lean: async () => deployment }),
      findById: () => ({ lean: async () => deployment }),
    },
    HealthCheck: {
      find: (q) => ({
        select: () => ({
          sort: () => ({
            lean: async () => (q.checkedAt.$lt ? checks : postChecks),
          }),
        }),
      }),
    },
    Incident: {
      find: () => ({
        select: () => ({ sort: () => ({ lean: async () => [] }) }),
      }),
    },
    DeploymentAlertState: {
      findOneAndUpdate: async (filter, update) => {
        if (filter._id && filter.$or) {
          // Atomic claim
          alertDoc = {
            ...alertDoc,
            notificationState: NOTIFICATION_STATES.DISPATCHING,
            notificationAttempts: (alertDoc.notificationAttempts || 0) + 1,
          };
          return alertDoc;
        }
        alertDoc = {
          ...alertDoc,
          ...update.$set,
        };
        return alertDoc;
      },
    },
    createNotification: async () => {
      throw new Error("Provider rate limited");
    },
    isInternal: true,
  };

  // Attempt 1 failure -> backoff 1 minute (2^0 * 60s)
  const res1 = await evaluateDeploymentRegression({
    monitorId: monitorAId,
    deploymentId: deploymentAId,
    deps: mockDeps,
  });

  assert.equal(res1.alertDispatched, false);
  assert.equal(alertDoc.notificationState, NOTIFICATION_STATES.FAILED);
  assert.ok(alertDoc.nextRetryAt instanceof Date);
  const diff1 = alertDoc.nextRetryAt.getTime() - Date.now();
  assert.ok(
    diff1 >= 50000 && diff1 <= 65000,
    `Expected ~60s backoff, got ${diff1}ms`,
  );

  // Fast-forward to attempt 5 (terminal attempt)
  alertDoc.notificationAttempts = 4;
  alertDoc.nextRetryAt = new Date(Date.now() - 1000); // due now!

  const res5 = await evaluateDeploymentRegression({
    monitorId: monitorAId,
    deploymentId: deploymentAId,
    deps: mockDeps,
  });

  assert.equal(res5.alertDispatched, false);
  assert.equal(
    alertDoc.nextRetryAt,
    null,
    "Terminal failure must NOT set further retry time",
  );
  assert.match(
    alertDoc.lastNotificationError,
    /permanently failed after 5 attempts/i,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap 5: Documented HMAC Header and immediateRevocation Validator
// ─────────────────────────────────────────────────────────────────────────────
test("Gap 5 (P2): rotateDeploymentSecret accepts both immediateRevoke and immediateRevocation", () => {
  // Using immediateRevocation (as documented in guide)
  const parsed1 = rotateDeploymentSecretSchema.parse({
    immediateRevocation: true,
  });
  assert.equal(parsed1.immediateRevoke, true);

  // Using immediateRevoke
  const parsed2 = rotateDeploymentSecretSchema.parse({ immediateRevoke: true });
  assert.equal(parsed2.immediateRevoke, true);

  // Default
  const parsed3 = rotateDeploymentSecretSchema.parse({});
  assert.equal(parsed3.immediateRevoke, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap 6: Fail Closed on Internal Evaluation Bypass
// ─────────────────────────────────────────────────────────────────────────────
test("Gap 6 (P2): evaluateDeploymentRegression fails closed when user is missing and isInternal is not set", async () => {
  await assert.rejects(
    async () => {
      await evaluateDeploymentRegression({
        monitorId: monitorAId,
        deploymentId: deploymentAId,
        // user omitted, deps.isInternal NOT set
        deps: {},
      });
    },
    (err) => {
      assert.equal(err.statusCode, 401);
      assert.match(err.message, /Authentication required/i);
      return true;
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap 7: Whitespace Environment Normalization
// ─────────────────────────────────────────────────────────────────────────────
test("Gap 7 (P3): Whitespace-only environment falls back to integration environment", async () => {
  const integration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    environment: "staging",
    monitors: [],
  };

  const origMonitorFind = mongoose.model("Monitor").find;
  const origDeploymentFindOne = mongoose.model("DeploymentEvent").findOne;
  const origDeploymentCreate = mongoose.model("DeploymentEvent").create;

  let createdDoc = null;

  mongoose.model("Monitor").find = () => ({
    select: async () => [
      {
        _id: new mongoose.Types.ObjectId(monitorAId),
        owner: new mongoose.Types.ObjectId(userAId),
        name: "Test Monitor",
      },
    ],
  });

  mongoose.model("DeploymentEvent").findOne = async () => null;
  mongoose.model("DeploymentEvent").create = async (doc) => {
    createdDoc = doc;
    return {
      toJSON: () => ({ id: "dep-white", ...doc }),
    };
  };

  try {
    // 1. Zod validator transforms "   " to undefined
    const validated = ingestDeploymentEventSchema.parse({
      monitors: [monitorAId],
      version: "v1.0.0",
      environment: "   ",
    });
    assert.equal(validated.environment, undefined);

    // 2. Service normalizes "   " and falls back to integration.environment ("staging")
    const res = await recordDeploymentEvent({
      integration,
      payload: {
        monitors: [monitorAId],
        version: "v1.0.0",
        environment: "   ",
      },
    });

    assert.equal(
      res.event.environment,
      "staging",
      "Whitespace environment must fall back to integration.environment",
    );
  } finally {
    mongoose.model("Monitor").find = origMonitorFind;
    mongoose.model("DeploymentEvent").findOne = origDeploymentFindOne;
    mongoose.model("DeploymentEvent").create = origDeploymentCreate;
  }
});
