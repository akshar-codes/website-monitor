import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import express from "express";
import { createHmac, createHash } from "node:crypto";

import env from "../src/config/env.js";
import { ROLES, PLANS } from "../src/config/constants.js";
import {
  generateDeploymentSecret,
  rotateDeploymentSecret,
  authenticateDeploymentSignature,
  recordDeploymentEvent,
  evaluateRegressionEvidence,
} from "../src/services/deployment.service.js";
import { evaluateDeploymentRegression } from "../src/services/deploymentRegression.service.js";
import {
  NOTIFICATION_STATES,
  REGRESSION_STATUSES,
  REGRESSION_TYPES,
} from "../src/models/DeploymentAlertState.js";
import { ingestDeploymentEventSchema } from "../src/validators/deployment.validator.js";
import * as worker from "../src/workers/deploymentRegressionWorker.js";

// Ensure encryption key is configured
env.ALERT_CREDENTIAL_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const userAId = "64b0000000000000000000a1";
const userBId = "64b0000000000000000000b2";
const monitorAId = "64b000000000000000000001";
const monitorBId = "64b000000000000000000002";
const deploymentAId = "64b0000000000000000000d1";

test("Issue 1 (P1): Cross-account regression evaluation is rejected with 403", async () => {
  const userA = { id: userAId, _id: userAId, role: ROLES.USER };
  const userB = { id: userBId, _id: userBId, role: ROLES.USER };

  const monitorB = {
    _id: new mongoose.Types.ObjectId(monitorBId),
    name: "User B Monitor",
    owner: new mongoose.Types.ObjectId(userBId),
  };

  const deploymentB = {
    _id: new mongoose.Types.ObjectId(deploymentAId),
    version: "v1.0.0",
    owner: new mongoose.Types.ObjectId(userBId),
    monitors: [monitorB._id],
    deployedAt: new Date(),
  };

  const mockDeps = {
    Monitor: {
      findOne: (query) => ({
        lean: async () => {
          if (query.owner && query.owner.toString() !== userBId) return null;
          return monitorB;
        },
      }),
      findById: () => ({
        select: () => ({
          lean: async () => monitorB,
        }),
      }),
    },
    DeploymentEvent: {
      findOne: (query) => ({
        lean: async () => {
          if (query.owner && query.owner.toString() !== userBId) return null;
          return deploymentB;
        },
      }),
      findById: () => ({
        select: () => ({
          lean: async () => deploymentB,
        }),
      }),
    },
    DeploymentAlertState: {
      findOneAndUpdate: async () => {
        assert.fail(
          "DeploymentAlertState should NOT be modified on cross-account access",
        );
      },
    },
    createNotification: async () => {
      assert.fail("Notifications should NOT be sent on cross-account access");
    },
  };

  // User A attempts to evaluate User B's monitor & deployment
  await assert.rejects(
    async () => {
      await evaluateDeploymentRegression({
        monitorId: monitorBId,
        deploymentId: deploymentAId,
        user: userA, // Authenticated as User A
        deps: mockDeps,
      });
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /Access denied|match/i);
      return true;
    },
  );
});

test("Issue 2 (P1/P2): HMAC verification verifies raw body bytes", async () => {
  const secretData = generateDeploymentSecret();
  const rawBodyString =
    '{\n  "version": "v1.0.0",\n  "monitors": ["' + monitorAId + '"]\n}';
  const rawBodyBuffer = Buffer.from(rawBodyString, "utf8");

  const signature = createHmac("sha256", secretData.secret)
    .update(rawBodyBuffer)
    .digest("hex");

  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    prefix: secretData.prefix,
    encryptedSecret: secretData.encryptedSecret,
    secretHash: secretData.secretHash,
    owner: new mongoose.Types.ObjectId(userAId),
    isActive: true,
    revokedAt: null,
  };

  // Mock DeploymentIntegration and User
  const origFindOneInt = mongoose.model("DeploymentIntegration").findOne;
  const origFindOneUser = mongoose.model("User").findOne;

  mongoose.model("DeploymentIntegration").findOne = () => ({
    select: async () => fakeIntegration,
  });
  mongoose.model("User").findOne = () => ({
    select: async () => ({
      _id: userAId,
      role: ROLES.USER,
      plan: PLANS.PRO,
      active: true,
    }),
  });

  try {
    const verified = await authenticateDeploymentSignature({
      keyIdentifier: secretData.prefix,
      signature: `sha256=${signature}`,
      rawBody: rawBodyBuffer,
    });

    assert.ok(verified, "HMAC verification must succeed on raw body bytes");
    assert.equal(
      verified.integration._id.toString(),
      fakeIntegration._id.toString(),
    );
  } finally {
    mongoose.model("DeploymentIntegration").findOne = origFindOneInt;
    mongoose.model("User").findOne = origFindOneUser;
  }
});

test("Issue 3 (P1/P2): Delivery state machine transitions to FAILED on notification error and allows retry", async () => {
  const monitor = {
    _id: new mongoose.Types.ObjectId(monitorAId),
    name: "Production API",
    owner: new mongoose.Types.ObjectId(userAId),
  };

  const deployment = {
    _id: new mongoose.Types.ObjectId(deploymentAId),
    owner: new mongoose.Types.ObjectId(userAId),
    version: "v3.2.0",
    environment: "production",
    deployedAt: new Date(Date.now() - 40 * 60 * 1000),
    monitors: [monitor._id],
  };

  const beforeChecks = [
    {
      status: "up",
      responseTime: 50,
      checkedAt: new Date(Date.now() - 50 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 50,
      checkedAt: new Date(Date.now() - 45 * 60 * 1000),
      scheduled: true,
    },
    {
      status: "up",
      responseTime: 50,
      checkedAt: new Date(Date.now() - 42 * 60 * 1000),
      scheduled: true,
    },
  ];
  const afterChecks = [
    {
      status: "up",
      responseTime: 150,
      checkedAt: new Date(Date.now() - 35 * 60 * 1000),
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
      checkedAt: new Date(Date.now() - 15 * 60 * 1000),
      scheduled: true,
    },
  ];

  let currentAlertDoc = null;
  let notificationAttemptCount = 0;

  const mockDeps = {
    Monitor: {
      findById: () => ({ lean: async () => monitor }),
      findOne: () => ({ lean: async () => monitor }),
    },
    DeploymentEvent: {
      findById: () => ({ lean: async () => deployment }),
      findOne: () => ({ lean: async () => deployment }),
    },
    HealthCheck: {
      find: (q) => ({
        select: () => ({
          sort: () => ({
            lean: async () => (q.checkedAt.$lt ? beforeChecks : afterChecks),
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
        // Atomic claim filter
        if (filter._id && filter.$or) {
          if (!currentAlertDoc) return null;
          const isDue =
            !currentAlertDoc.alertDispatchedAt ||
            currentAlertDoc.notificationState === "failed" ||
            currentAlertDoc.notificationState !== "sent";
          if (!isDue) return null;
          currentAlertDoc = {
            ...currentAlertDoc,
            ...update.$set,
          };
          return currentAlertDoc;
        }

        // Status update after notification attempt
        if (filter._id && !filter.$or) {
          currentAlertDoc = {
            ...currentAlertDoc,
            ...update.$set,
          };
          return currentAlertDoc;
        }

        // Upsert
        currentAlertDoc = {
          _id: currentAlertDoc?._id || new mongoose.Types.ObjectId(),
          ...currentAlertDoc,
          ...update.$set,
          ...update.$setOnInsert,
        };
        return currentAlertDoc;
      },
    },
    createNotification: async ({ throwOnError }) => {
      notificationAttemptCount++;
      if (notificationAttemptCount === 1) {
        throw new Error("Mail transport offline");
      }
      return { id: "notif-success" };
    },
    logActivity: async () => ({}),
    isInternal: true,
  };

  // Run 1: Notification fails -> must mark state as FAILED and NOT lock out with cooldown
  const run1 = await evaluateDeploymentRegression({
    monitorId: monitorAId,
    deploymentId: deploymentAId,
    deps: mockDeps,
  });

  assert.equal(run1.alertDispatched, false);
  assert.equal(currentAlertDoc.notificationState, NOTIFICATION_STATES.FAILED);
  assert.match(currentAlertDoc.lastNotificationError, /Mail transport offline/);
  // cooldownUntil should NOT be set into future
  assert.ok(!currentAlertDoc.cooldownUntil);

  // Run 2: Notification succeeds on retry
  const run2 = await evaluateDeploymentRegression({
    monitorId: monitorAId,
    deploymentId: deploymentAId,
    deps: mockDeps,
  });

  assert.equal(run2.alertDispatched, true);
  assert.equal(currentAlertDoc.notificationState, NOTIFICATION_STATES.SENT);
  assert.ok(currentAlertDoc.cooldownUntil instanceof Date);
  assert.equal(currentAlertDoc.lastNotificationError, null);
});

test("Issue 4 (P2): Canonical deduplication key and compound index are 1:1 per deployment and monitor", () => {
  const schema = mongoose.model("DeploymentAlertState").schema;
  const indexes = schema.indexes();

  // Verify compound unique index on { deployment: 1, monitor: 1 }
  const uniqueDeploymentMonitor = indexes.find(
    ([fields, opts]) =>
      fields.deployment === 1 && fields.monitor === 1 && opts?.unique === true,
  );
  assert.ok(
    uniqueDeploymentMonitor,
    "Compound unique index on { deployment: 1, monitor: 1 } must exist",
  );
});

test("Issue 5 (P2): Background evaluation worker exports start and stop", async () => {
  assert.equal(typeof worker.start, "function");
  assert.equal(typeof worker.stop, "function");
  assert.equal(typeof worker.runDeploymentRegressionSweep, "function");

  // Worker start and immediate graceful stop
  worker.start(60000);
  await worker.stop();
});

test("Issue 6: Strict date validation and clock skew limits", () => {
  // 1. Invalid date string
  assert.throws(() => {
    ingestDeploymentEventSchema.parse({
      monitors: [monitorAId],
      version: "v1.0.0",
      deployedAt: "not-a-valid-date",
    });
  }, /deployedAt/i);

  // 2. Clock skew: > 15 minutes into future
  const futureDate = new Date(Date.now() + 25 * 60 * 1000).toISOString();
  assert.throws(() => {
    ingestDeploymentEventSchema.parse({
      monitors: [monitorAId],
      version: "v1.0.0",
      deployedAt: futureDate,
    });
  }, /more than 15 minutes in the future/i);

  // 3. Historical limit: > 30 days in the past
  const pastDate = new Date(
    Date.now() - 35 * 24 * 60 * 60 * 1000,
  ).toISOString();
  assert.throws(() => {
    ingestDeploymentEventSchema.parse({
      monitors: [monitorAId],
      version: "v1.0.0",
      deployedAt: pastDate,
    });
  }, /older than 30 days/i);

  // 4. Valid date within bounds
  const validParsed = ingestDeploymentEventSchema.parse({
    monitors: [monitorAId],
    version: "v1.0.0",
    deployedAt: new Date(Date.now() - 60 * 1000).toISOString(),
  });
  assert.ok(validParsed.deployedAt instanceof Date);
  assert.equal(
    validParsed.environment,
    undefined,
    "environment should be undefined when omitted",
  );
});

test("Issue 6 & 7: Environment resolution order and deterministic idempotency fallback", async () => {
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
      toJSON: () => ({ id: "dep-1", ...doc }),
    };
  };

  try {
    // 1. When payload environment is omitted, fallback to integration.environment ("staging")
    const res = await recordDeploymentEvent({
      integration,
      payload: {
        monitors: [monitorAId],
        version: "v1.0.0",
        // externalId and idempotencyKey omitted
      },
    });

    assert.equal(res.event.environment, "staging");
    assert.ok(
      createdDoc.idempotencyKey,
      "Deterministic fallback idempotency key must be generated",
    );
    assert.match(createdDoc.idempotencyKey, /^auto_[a-f0-9]{32}$/);

    // 2. Calling with deterministic fallback key should detect duplicate on retry
    mongoose.model("DeploymentEvent").findOne = async (query) => {
      if (
        query.$or?.some((c) => c.idempotencyKey === createdDoc.idempotencyKey)
      ) {
        return { toJSON: () => createdDoc };
      }
      return null;
    };

    const retryRes = await recordDeploymentEvent({
      integration,
      payload: {
        monitors: [monitorAId],
        version: "v1.0.0",
      },
    });

    assert.equal(retryRes.isDuplicate, true);
  } finally {
    mongoose.model("Monitor").find = origMonitorFind;
    mongoose.model("DeploymentEvent").findOne = origDeploymentFindOne;
    mongoose.model("DeploymentEvent").create = origDeploymentCreate;
  }
});

test("Issue 8: Secret rotation retains previousEncryptedSecret for 15-minute grace period HMAC", async () => {
  const secretA = generateDeploymentSecret();
  const integrationDoc = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretA.prefix,
    secretHash: secretA.secretHash,
    encryptedSecret: secretA.encryptedSecret,
    previousEncryptedSecret: null,
    secretRotatedAt: null,
    isActive: true,
    revokedAt: null,
    toJSON: function () {
      return { ...this };
    },
    save: async function () {
      return this;
    },
  };

  const origFindOne = mongoose.model("DeploymentIntegration").findOne;
  const origFindUser = mongoose.model("User").findOne;

  const user = { id: userAId, _id: userAId };

  mongoose.model("DeploymentIntegration").findOne = () => ({
    select: async () => integrationDoc,
  });
  mongoose.model("User").findOne = () => ({
    select: async () => ({
      _id: userAId,
      role: ROLES.USER,
      plan: PLANS.PRO,
      active: true,
    }),
  });

  try {
    // Rotate secret without immediate revocation
    const rotated = await rotateDeploymentSecret(user, integrationDoc._id, {
      immediateRevoke: false,
    });
    assert.equal(
      integrationDoc.previousEncryptedSecret,
      secretA.encryptedSecret,
    );
    assert.ok(integrationDoc.secretRotatedAt instanceof Date);

    // Verify HMAC with old secret during grace period
    const rawBody = Buffer.from('{"version":"v1"}');
    const oldSig = createHmac("sha256", secretA.secret)
      .update(rawBody)
      .digest("hex");

    mongoose.model("DeploymentIntegration").findOne = () => ({
      select: async () => ({
        ...integrationDoc,
        encryptedSecret: integrationDoc.encryptedSecret,
        previousEncryptedSecret: integrationDoc.previousEncryptedSecret,
        secretRotatedAt: integrationDoc.secretRotatedAt,
        owner: new mongoose.Types.ObjectId(userAId),
        isActive: true,
        revokedAt: null,
      }),
    });

    const verified = await authenticateDeploymentSignature({
      keyIdentifier: secretA.prefix,
      signature: oldSig,
      rawBody,
    });
    assert.ok(
      verified,
      "Old secret must authenticate during rotation grace period",
    );
  } finally {
    mongoose.model("DeploymentIntegration").findOne = origFindOne;
    mongoose.model("User").findOne = origFindUser;
  }
});

test("Issue 9: Incomplete window reports evaluating status instead of normal", () => {
  const beforeStats = {
    sampleCount: 10,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 40,
    p95ResponseTime: 50,
    hasSufficientSamples: true,
  };

  const afterStats = {
    sampleCount: 3,
    availability: 100,
    failureRate: 0,
    medianResponseTime: 42,
    p95ResponseTime: 52,
    hasSufficientSamples: true,
  };

  const diff = {
    availabilityChange: 0,
    failureRateChange: 0,
    medianResponseTimeChangeMs: 2,
    medianResponseTimeChangePercent: 5,
    p95ResponseTimeChangeMs: 2,
    p95ResponseTimeChangePercent: 4,
  };

  // Window incomplete (now < afterEnd)
  const resultIncomplete = evaluateRegressionEvidence({
    before: beforeStats,
    after: afterStats,
    diff,
    relatedIncidents: [],
    isWindowIncomplete: true,
  });

  assert.equal(
    resultIncomplete.status,
    "evaluating",
    "Should report 'evaluating' while observation window is in progress",
  );

  // Window completed (now >= afterEnd)
  const resultComplete = evaluateRegressionEvidence({
    before: beforeStats,
    after: afterStats,
    diff,
    relatedIncidents: [],
    isWindowIncomplete: false,
  });

  assert.equal(
    resultComplete.status,
    "normal",
    "Should report 'normal' only when observation window is complete",
  );
});
