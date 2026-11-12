import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { createHash, createHmac, randomBytes } from "node:crypto";
import DeploymentIntegration from "../src/models/DeploymentIntegration.js";
import DeploymentEvent from "../src/models/DeploymentEvent.js";
import Monitor from "../src/models/Monitor.js";
import User from "../src/models/User.js";
import ApiKey from "../src/models/ApiKey.js";
import Activity from "../src/models/Activity.js";
import { ROLES, PLANS } from "../src/config/constants.js";
import env from "../src/config/env.js";
import {
  generateDeploymentSecret,
  hashDeploymentSecret,
  compareSecretHashes,
  createDeploymentIntegration,
  rotateDeploymentSecret,
  revokeDeploymentIntegration,
  deleteDeploymentIntegration,
  recordDeploymentEvent,
} from "../src/services/deployment.service.js";
import { encryptCredential } from "../src/utils/credentialEncryption.js";

// Setup test environment variables
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27099/site-watch-tests",
  COOKIE_SECRET: "test-cookie-secret-with-more-than-thirty-two-characters",
  SESSION_SECRET: "test-session-secret-with-more-than-thirty-two-characters",
  ALERT_CREDENTIAL_ENCRYPTION_KEY:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
});
env.ALERT_CREDENTIAL_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const userAId = "64b0000000000000000000a1";
const userBId = "64b0000000000000000000b2";
const monitorAId = "64b000000000000000000001";
const monitorBId = "64b000000000000000000002";

let server;
let baseUrl;

before(async () => {
  const [
    { default: routes },
    { default: notFound },
    { default: errorHandler },
  ] = await Promise.all([
    import("../src/routes/index.js"),
    import("../src/middlewares/notFound.js"),
    import("../src/middlewares/errorHandler.js"),
  ]);

  Activity.create = async () => ({});

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.get("x-test-role");
    req.isAuthenticated = () => Boolean(role);
    if (role) {
      const id = req.get("x-test-user-id") || userAId;
      const plan = req.get("x-test-plan") || (role === "admin" ? null : "pro");
      req.user = {
        id,
        _id: id,
        role,
        active: true,
        plan,
        planStatus: role === "admin" ? null : "active",
      };
    }
    next();
  });

  app.use("/api", routes);
  app.use(notFound);
  app.use(errorHandler);

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

const request = (
  path,
  {
    role,
    userId,
    plan,
    token,
    signature,
    keyIdentifier,
    idempotencyKey,
    method = "GET",
    body,
    headers: extraHeaders = {},
  } = {},
) => {
  const headers = {
    ...(role ? { "x-test-role": role } : {}),
    ...(userId ? { "x-test-user-id": userId } : {}),
    ...(plan ? { "x-test-plan": plan } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(signature ? { "x-deployment-signature": signature } : {}),
    ...(keyIdentifier ? { "x-deployment-key": keyIdentifier } : {}),
    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...extraHeaders,
  };

  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Model & Index Verification
// ─────────────────────────────────────────────────────────────────────────────

test("DeploymentEvent Model: validates required fields and schema constraints", async () => {
  const doc = new DeploymentEvent({ environment: null });
  let err;
  try {
    await doc.validate();
  } catch (e) {
    err = e;
  }
  assert.ok(err);
  assert.ok(err.errors.owner, "Owner is required");
  assert.ok(err.errors.monitors, "Monitors array is required");
  assert.ok(err.errors.version, "Release version is required");
  assert.ok(err.errors.environment, "Environment is required");
});

test("DeploymentEvent Model: affectedMonitors virtual returns monitors array and toJSON transforms", () => {
  const doc = new DeploymentEvent({
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    monitors: [new mongoose.Types.ObjectId(monitorAId)],
    version: "v1.0.0",
    commitSha: "abc1234",
    environment: "production",
    metadata: new Map([["ci_build", "456"]]),
  });

  assert.equal(doc.affectedMonitors.length, 1);
  assert.equal(doc.affectedMonitors[0].toString(), monitorAId);

  const json = doc.toJSON();
  assert.ok(json.id, "id must replace _id in toJSON");
  assert.equal(json._id, undefined);
  assert.equal(json.__v, undefined);
  assert.equal(json.metadata.ci_build, "456");
});

test("DeploymentEvent Model: defines appropriate indexes for owner, monitor, environment, deployedAt and idempotency", () => {
  const indexes = DeploymentEvent.schema.indexes();
  const indexKeys = indexes.map(([fields]) => Object.keys(fields).join(","));

  assert.ok(
    indexKeys.includes("owner,deployedAt"),
    "Index on owner, deployedAt",
  );
  assert.ok(
    indexKeys.includes("monitors,deployedAt"),
    "Index on monitors, deployedAt",
  );
  assert.ok(
    indexKeys.includes("owner,environment,deployedAt"),
    "Index on owner, environment, deployedAt",
  );
  assert.ok(
    indexKeys.includes("monitors,environment,deployedAt"),
    "Index on monitors, environment, deployedAt",
  );

  const externalIdIndex = indexes.find(
    ([fields]) => fields.owner === 1 && fields.externalId === 1,
  );
  assert.ok(externalIdIndex, "Unique index on owner and externalId");
  assert.equal(externalIdIndex[1].unique, true);
  assert.deepEqual(externalIdIndex[1].partialFilterExpression, {
    externalId: { $type: "string" },
  });

  const idempotencyKeyIndex = indexes.find(
    ([fields]) => fields.owner === 1 && fields.idempotencyKey === 1,
  );
  assert.ok(idempotencyKeyIndex, "Unique index on owner and idempotencyKey");
  assert.equal(idempotencyKeyIndex[1].unique, true);
  assert.deepEqual(idempotencyKeyIndex[1].partialFilterExpression, {
    idempotencyKey: { $type: "string" },
  });
});

test("DeploymentIntegration Model: redacts secrets from toJSON and enforces prefix uniqueness", () => {
  const doc = new DeploymentIntegration({
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    name: "GitHub Actions",
    prefix: "dep_live_0123456789ab",
    secretHash: "testhash",
    previousSecretHash: "prevhash",
    encryptedSecret: "encryptedvalue",
  });

  const json = doc.toJSON();
  assert.equal(json._id, undefined);
  assert.equal(
    json.secretHash,
    undefined,
    "secretHash must be stripped in toJSON",
  );
  assert.equal(
    json.previousSecretHash,
    undefined,
    "previousSecretHash must be stripped in toJSON",
  );
  assert.equal(
    json.encryptedSecret,
    undefined,
    "encryptedSecret must be stripped in toJSON",
  );
  assert.ok(json.id);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Integration Credential Management (Creation, Rotation, Revocation)
// ─────────────────────────────────────────────────────────────────────────────

test("Deployment Credential Service: generates high-entropy secret, prefix, and hash", () => {
  const { secret, prefix, secretHash, encryptedSecret } =
    generateDeploymentSecret();
  assert.match(secret, /^dep_live_[a-f0-9]{12}_[A-Za-z0-9_-]{32,64}$/);
  assert.match(prefix, /^dep_live_[a-f0-9]{12}$/);
  assert.equal(secretHash, hashDeploymentSecret(secret));
  assert.ok(compareSecretHashes(secretHash, hashDeploymentSecret(secret)));
  assert.ok(
    encryptedSecret,
    "Encrypted secret must be generated when encryption key configured",
  );
});

test("Deployment Credential Management API: administrators cannot create integrations directly", async () => {
  const res = await request("/deployments/integrations", {
    role: ROLES.ADMIN,
    userId: "admin-id",
    method: "POST",
    body: { name: "Admin Deployments" },
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
});

test("Deployment Credential Management API: creates integration and returns secret once", async (t) => {
  const fakeId = new mongoose.Types.ObjectId();
  const secretData = generateDeploymentSecret();

  const fakeDoc = {
    _id: fakeId,
    owner: userAId,
    name: "CI Pipeline",
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    environment: "production",
    monitors: [],
    toJSON() {
      return {
        id: String(fakeId),
        name: "CI Pipeline",
        prefix: secretData.prefix,
        environment: "production",
        monitors: [],
      };
    },
  };

  t.mock.method(DeploymentIntegration, "countDocuments", async () => 0);
  t.mock.method(DeploymentIntegration, "create", async () => fakeDoc);

  const res = await request("/deployments/integrations", {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: { name: "CI Pipeline", environment: "production" },
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.secret, "Plaintext secret must be returned on creation");
  assert.match(data.data.secret, /^dep_live_/);
  assert.equal(
    data.data.secretHash,
    undefined,
    "secretHash must never be exposed",
  );
});

test("Deployment Credential Management API: enforces plan quota on integrations", async (t) => {
  t.mock.method(DeploymentIntegration, "countDocuments", async () => 2);

  const res = await request("/deployments/integrations", {
    role: ROLES.USER,
    userId: userAId,
    plan: PLANS.FREE,
    method: "POST",
    body: { name: "Third Integration" },
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, "UPGRADE_REQUIRED");
});

test("Deployment Credential Management API: rotates secret and retains previous hash", async (t) => {
  const intId = new mongoose.Types.ObjectId();
  const oldSecret = generateDeploymentSecret();

  const fakeDoc = {
    _id: intId,
    owner: userAId,
    prefix: oldSecret.prefix,
    secretHash: oldSecret.secretHash,
    previousSecretHash: null,
    secretRotatedAt: null,
    save: async () => fakeDoc,
    toJSON() {
      return { id: String(intId), prefix: this.prefix };
    },
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: () => fakeDoc,
  }));

  const res = await request(`/deployments/integrations/${intId}/rotate`, {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: { immediateRevoke: false },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(
    data.data.secret,
    "New plaintext secret must be returned on rotation",
  );
  assert.match(data.data.secret, /^dep_live_/);
  assert.equal(data.data.previousSecretRevoked, false);
  assert.equal(fakeDoc.previousSecretHash, oldSecret.secretHash);
  assert.ok(fakeDoc.secretRotatedAt);
});

test("Deployment Credential Management API: immediate revocation clears previous secret hash on rotation", async (t) => {
  const intId = new mongoose.Types.ObjectId();
  const oldSecret = generateDeploymentSecret();

  const fakeDoc = {
    _id: intId,
    owner: userAId,
    prefix: oldSecret.prefix,
    secretHash: oldSecret.secretHash,
    previousSecretHash: null,
    secretRotatedAt: null,
    save: async () => fakeDoc,
    toJSON() {
      return { id: String(intId), prefix: this.prefix };
    },
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: () => fakeDoc,
  }));

  const res = await request(`/deployments/integrations/${intId}/rotate`, {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
    body: { immediateRevoke: true },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.data.previousSecretRevoked, true);
  assert.equal(fakeDoc.previousSecretHash, null);
});

test("Deployment Credential Management API: revokes integration and rejects subsequent use", async (t) => {
  const intId = new mongoose.Types.ObjectId();
  const fakeDoc = {
    _id: intId,
    owner: userAId,
    revokedAt: new Date(),
    isActive: false,
    toJSON() {
      return { id: String(intId), revokedAt: this.revokedAt, isActive: false };
    },
  };

  t.mock.method(DeploymentIntegration, "findOneAndUpdate", async () => fakeDoc);

  const res = await request(`/deployments/integrations/${intId}/revoke`, {
    role: ROLES.USER,
    userId: userAId,
    method: "POST",
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.isActive, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Deployment Ingestion Authentication & Security
// ─────────────────────────────────────────────────────────────────────────────

test("Deployment Ingestion API: rejects unauthenticated requests", async () => {
  const res = await request("/deployments/events", {
    method: "POST",
    body: {
      monitors: [monitorAId],
      version: "v1.0.0",
    },
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
});

test("Deployment Ingestion API: explicitly rejects general read-only API keys (wm_live_*)", async () => {
  const fakeApiKey =
    "wm_live_0123456789ab_abcdefghijklmnopqrstuvwxyz0123456789ABCDEF";

  const res = await request("/deployments/events", {
    token: fakeApiKey,
    method: "POST",
    body: {
      monitors: [monitorAId],
      version: "v1.0.0",
    },
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.message, /General API keys cannot be used for deployment/i);
});

test("Deployment Ingestion API: rejects invalid or tampered deployment tokens", async () => {
  const res = await request("/deployments/events", {
    token: "dep_live_invalidtokenformat_tooshort",
    method: "POST",
    body: {
      monitors: [monitorAId],
      version: "v1.0.0",
    },
  });

  assert.equal(res.status, 401);
});

test("Deployment Ingestion API: rejects revoked deployment credentials", async (t) => {
  const secretData = generateDeploymentSecret();

  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: userAId,
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: false,
    revokedAt: new Date(),
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));

  const res = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: {
      monitors: [monitorAId],
      version: "v1.0.0",
    },
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.message, /revoked/i);
});

test("Deployment Ingestion API: authenticates valid Bearer token and creates deployment event", async (t) => {
  const secretData = generateDeploymentSecret();
  const intId = new mongoose.Types.ObjectId();

  const fakeIntegration = {
    _id: intId,
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: true,
    revokedAt: null,
  };

  const fakeUser = {
    _id: userAId,
    role: ROLES.USER,
    plan: PLANS.PRO,
    active: true,
  };

  const fakeMonitor = {
    _id: new mongoose.Types.ObjectId(monitorAId),
    owner: new mongoose.Types.ObjectId(userAId),
    name: "Web App",
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(DeploymentIntegration, "updateOne", async () => ({}));
  t.mock.method(User, "findOne", () => ({
    select: async () => fakeUser,
  }));
  t.mock.method(Monitor, "find", () => ({
    select: async () => [fakeMonitor],
  }));
  t.mock.method(DeploymentEvent, "findOne", async () => null);

  let createdPayload = null;
  t.mock.method(DeploymentEvent, "create", async (payload) => {
    createdPayload = payload;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      toJSON() {
        return { id: "event-1", ...payload };
      },
    };
  });

  const res = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: {
      monitors: [monitorAId],
      version: "v2.1.0",
      commitSha: "f4e3d2c1",
      environment: "production",
      source: "github-actions",
      url: "https://github.com/org/repo/actions/runs/12345",
      description: "Release v2.1.0 with fixes",
      externalId: "gh-run-12345",
    },
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.version, "v2.1.0");
  assert.equal(createdPayload.owner.toString(), userAId);
  assert.equal(createdPayload.source, "github-actions");
  assert.equal(createdPayload.externalId, "gh-run-12345");
});

test("Deployment Ingestion API: authenticates valid HMAC signature", async (t) => {
  const secretData = generateDeploymentSecret();
  const intId = new mongoose.Types.ObjectId();

  const fakeIntegration = {
    _id: intId,
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    encryptedSecret: secretData.encryptedSecret,
    isActive: true,
    revokedAt: null,
  };

  const fakeUser = {
    _id: userAId,
    role: ROLES.USER,
    plan: PLANS.PRO,
    active: true,
  };

  const fakeMonitor = {
    _id: new mongoose.Types.ObjectId(monitorAId),
    owner: new mongoose.Types.ObjectId(userAId),
    name: "Web App",
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(DeploymentIntegration, "updateOne", async () => ({}));
  t.mock.method(User, "findOne", () => ({
    select: async () => fakeUser,
  }));
  t.mock.method(Monitor, "find", () => ({
    select: async () => [fakeMonitor],
  }));
  t.mock.method(DeploymentEvent, "findOne", async () => null);
  t.mock.method(DeploymentEvent, "create", async (payload) => ({
    _id: new mongoose.Types.ObjectId(),
    ...payload,
    toJSON: () => ({ id: "event-sig", ...payload }),
  }));

  const payload = {
    monitors: [monitorAId],
    version: "v2.2.0",
    commitSha: "12345678",
  };

  const bodyText = JSON.stringify(payload);
  const signature = createHmac("sha256", secretData.secret)
    .update(bodyText)
    .digest("hex");

  const res = await request("/deployments/events", {
    signature,
    keyIdentifier: secretData.prefix,
    method: "POST",
    body: payload,
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
});

test("Deployment Ingestion API: rejects invalid HMAC signature", async (t) => {
  const secretData = generateDeploymentSecret();
  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    encryptedSecret: secretData.encryptedSecret,
    isActive: true,
    revokedAt: null,
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));

  const res = await request("/deployments/events", {
    signature:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    keyIdentifier: secretData.prefix,
    method: "POST",
    body: { monitors: [monitorAId], version: "v2.2.0" },
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.message, /signature/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cross-Tenant Protection & Payload Validation
// ─────────────────────────────────────────────────────────────────────────────

test("Deployment Ingestion API: rejects cross-tenant monitor references", async (t) => {
  const secretData = generateDeploymentSecret();

  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId), // Owned by User A
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: true,
    revokedAt: null,
  };

  const fakeUser = {
    _id: userAId,
    role: ROLES.USER,
    plan: PLANS.PRO,
    active: true,
  };

  // Monitor belongs to User B!
  const fakeMonitorOfUserB = {
    _id: new mongoose.Types.ObjectId(monitorBId),
    owner: new mongoose.Types.ObjectId(userBId),
    name: "Victim's Monitor",
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => fakeUser,
  }));
  t.mock.method(Monitor, "find", () => ({
    select: async () => [fakeMonitorOfUserB],
  }));

  const res = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: {
      monitors: [monitorBId],
      version: "v3.0.0",
    },
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /does not belong/i);
});

test("Deployment Ingestion API: never trusts owner supplied in request body", async (t) => {
  const secretData = generateDeploymentSecret();

  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId), // Legit owner is User A
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: true,
    revokedAt: null,
  };

  const fakeUser = {
    _id: userAId,
    role: ROLES.USER,
    plan: PLANS.PRO,
    active: true,
  };

  const fakeMonitor = {
    _id: new mongoose.Types.ObjectId(monitorAId),
    owner: new mongoose.Types.ObjectId(userAId),
    name: "My App",
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => fakeUser,
  }));
  t.mock.method(Monitor, "find", () => ({
    select: async () => [fakeMonitor],
  }));
  t.mock.method(DeploymentEvent, "findOne", async () => null);

  let capturedOwner = null;
  t.mock.method(DeploymentEvent, "create", async (payload) => {
    capturedOwner = payload.owner;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      toJSON: () => ({ id: "event-ok", ...payload }),
    };
  });

  const res = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: {
      owner: userBId, // Maliciously spoofed owner ID
      ownerId: userBId,
      monitors: [monitorAId],
      version: "v1.5.0",
    },
  });

  assert.equal(res.status, 201);
  assert.equal(
    capturedOwner.toString(),
    userAId,
    "Saved event owner must match integration owner, never request body",
  );
});

test("Deployment Ingestion API: rejects non-existent monitor references", async (t) => {
  const secretData = generateDeploymentSecret();
  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: true,
    revokedAt: null,
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => ({ _id: userAId, active: true }),
  }));
  t.mock.method(Monitor, "find", () => ({
    select: async () => [], // No monitor found!
  }));

  const res = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: {
      monitors: [monitorAId],
      version: "v1.0.0",
    },
  });

  assert.equal(res.status, 404);
  const data = await res.json();
  assert.match(data.message, /monitors do not exist/i);
});

test("Deployment Ingestion API: rejects invalid monitor ID formats", async (t) => {
  const secretData = generateDeploymentSecret();
  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: true,
    revokedAt: null,
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => ({ _id: userAId, active: true }),
  }));

  const res = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: {
      monitors: ["not-a-valid-object-id"],
      version: "v1.0.0",
    },
  });

  assert.equal(res.status, 400);
});

test("Deployment Ingestion API: rejects missing release version or name", async (t) => {
  const secretData = generateDeploymentSecret();
  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: true,
    revokedAt: null,
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => ({ _id: userAId, active: true }),
  }));

  const res = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: {
      monitors: [monitorAId],
    },
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Idempotency & Duplicate-Event Prevention
// ─────────────────────────────────────────────────────────────────────────────

test("Deployment Ingestion API: repeated submission with identical externalId returns duplicate safely without creating second event", async (t) => {
  const secretData = generateDeploymentSecret();
  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: true,
    revokedAt: null,
  };

  const fakeMonitor = {
    _id: new mongoose.Types.ObjectId(monitorAId),
    owner: new mongoose.Types.ObjectId(userAId),
    name: "Web App",
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => ({ _id: userAId, active: true }),
  }));
  t.mock.method(Monitor, "find", () => ({
    select: async () => [fakeMonitor],
  }));

  let eventDatabase = [];
  t.mock.method(DeploymentEvent, "findOne", async ({ owner, $or }) => {
    return (
      eventDatabase.find(
        (e) =>
          e.owner.toString() === owner.toString() &&
          e.externalId === "deploy-run-777",
      ) || null
    );
  });

  t.mock.method(DeploymentEvent, "create", async (payload) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      toJSON: () => ({ id: "event-777", ...payload }),
    };
    eventDatabase.push(doc);
    return doc;
  });

  const payload = {
    monitors: [monitorAId],
    version: "v4.0.0",
    externalId: "deploy-run-777",
  };

  // 1. First submission: creates new event
  const firstRes = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: payload,
  });

  assert.equal(firstRes.status, 201);
  const firstData = await firstRes.json();
  assert.equal(firstData.meta.duplicate, false);
  assert.equal(eventDatabase.length, 1);

  // 2. Retry identical submission: idempotent duplicate response
  const retryRes = await request("/deployments/events", {
    token: secretData.secret,
    method: "POST",
    body: payload,
  });

  assert.equal(retryRes.status, 200);
  const retryData = await retryRes.json();
  assert.equal(retryData.success, true);
  assert.equal(retryData.meta.duplicate, true);
  assert.equal(
    eventDatabase.length,
    1,
    "Exactly one event must exist in database",
  );
});

test("Deployment Ingestion API: idempotency key passed via HTTP header is respected", async (t) => {
  const secretData = generateDeploymentSecret();
  const fakeIntegration = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    prefix: secretData.prefix,
    secretHash: secretData.secretHash,
    isActive: true,
    revokedAt: null,
  };

  const fakeMonitor = {
    _id: new mongoose.Types.ObjectId(monitorAId),
    owner: new mongoose.Types.ObjectId(userAId),
    name: "Web App",
  };

  t.mock.method(DeploymentIntegration, "findOne", () => ({
    select: async () => fakeIntegration,
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => ({ _id: userAId, active: true }),
  }));
  t.mock.method(Monitor, "find", () => ({
    select: async () => [fakeMonitor],
  }));

  let storedEvents = [];
  t.mock.method(DeploymentEvent, "findOne", async () => {
    return storedEvents.length > 0 ? storedEvents[0] : null;
  });
  t.mock.method(DeploymentEvent, "create", async (payload) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      toJSON: () => ({ id: "event-hdr", ...payload }),
    };
    storedEvents.push(doc);
    return doc;
  });

  const payload = {
    monitors: [monitorAId],
    version: "v4.1.0",
  };

  const res1 = await request("/deployments/events", {
    token: secretData.secret,
    idempotencyKey: "header-idem-999",
    method: "POST",
    body: payload,
  });

  assert.equal(res1.status, 201);
  assert.equal(storedEvents[0].idempotencyKey, "header-idem-999");

  const res2 = await request("/deployments/events", {
    token: secretData.secret,
    idempotencyKey: "header-idem-999",
    method: "POST",
    body: payload,
  });

  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.meta.duplicate, true);
  assert.equal(storedEvents.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Preservation of Existing General API Key Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("Existing API Key Behavior: general API key endpoints remain read-only", async (t) => {
  const prefix = "wm_live_0123456789ab";
  const keySecret = `${prefix}_${randomBytes(32).toString("base64url")}`;
  const fakeKey = {
    _id: new mongoose.Types.ObjectId(),
    owner: new mongoose.Types.ObjectId(userAId),
    prefix,
    keyHash: createHash("sha256").update(keySecret).digest("hex"),
    expiresAt: null,
    revokedAt: null,
  };

  const fakeUser = {
    _id: userAId,
    role: ROLES.USER,
    plan: PLANS.PRO,
    active: true,
  };

  t.mock.method(ApiKey, "findOne", () => ({
    select: async () => fakeKey,
  }));
  t.mock.method(User, "findOne", () => ({
    select: async () => fakeUser,
  }));
  t.mock.method(ApiKey, "updateOne", async () => ({}));
  t.mock.method(Monitor, "find", () => ({
    sort: () => ({
      skip: () => ({
        limit: async () => [
          {
            id: monitorAId,
            _id: new mongoose.Types.ObjectId(monitorAId),
            name: "Production Web",
            url: "https://example.com",
            interval: 300,
            active: true,
          },
        ],
      }),
    }),
  }));
  t.mock.method(Monitor, "countDocuments", async () => 1);

  // 1. GET /api/v1/monitors succeeds with valid API key
  const getRes = await request("/v1/monitors", {
    token: keySecret,
    method: "GET",
  });

  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.success, true);
  assert.equal(getData.data.length, 1);

  // 2. POST to /api/v1 does not exist (404) preserving read-only nature
  const postRes = await request("/v1/monitors", {
    token: keySecret,
    method: "POST",
    body: { name: "New Monitor" },
  });

  assert.equal(postRes.status, 404);
});

test("Phase 2: Monitor-scoped deployment listing and individual retrieval", async (t) => {
  const deploymentEventId = "64b0000000000000000000d1";
  const fakeMonitorA = {
    _id: new mongoose.Types.ObjectId(monitorAId),
    id: monitorAId,
    name: "Production Web",
    owner: new mongoose.Types.ObjectId(userAId),
  };

  const fakeEvents = [
    {
      _id: new mongoose.Types.ObjectId(deploymentEventId),
      version: "v2.1.0",
      commitSha: "abcdef123456",
      environment: "production",
      deployedAt: new Date(),
      receivedAt: new Date(),
      source: "github-actions",
      url: "https://github.com/org/repo/actions/runs/123",
      description: "Release v2.1.0 with latency improvements",
      externalId: "deploy-12345",
      monitors: [new mongoose.Types.ObjectId(monitorAId)],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // 1. Valid request to GET /api/monitors/:id/deployments
  t.mock.method(Monitor, "findOne", ({ _id, owner }) => {
    if (String(_id) === monitorAId && String(owner) === userAId) {
      return { lean: async () => fakeMonitorA };
    }
    return { lean: async () => null };
  });

  t.mock.method(DeploymentEvent, "find", (query) => {
    assert.equal(String(query.owner), userAId);
    assert.equal(String(query.monitors), monitorAId);
    return {
      select: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => fakeEvents,
            }),
          }),
        }),
      }),
    };
  });
  t.mock.method(DeploymentEvent, "countDocuments", async () => 1);

  const listRes = await request(
    `/monitors/${monitorAId}/deployments?window=24h&environment=production`,
    {
      role: "user",
      userId: userAId,
    },
  );

  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.equal(listJson.success, true);
  assert.equal(listJson.data.length, 1);
  assert.equal(listJson.data[0].version, "v2.1.0");
  assert.equal(listJson.data[0].commitSha, "abcdef123456");
  assert.equal(listJson.data[0].environment, "production");
  assert.equal(listJson.data[0].externalId, "deploy-12345");
  // Ensure credentials and internal secrets are NEVER leaked
  assert.equal(listJson.data[0].secret, undefined);
  assert.equal(listJson.data[0].secretHash, undefined);
  assert.equal(listJson.data[0].integration, undefined);
  assert.equal(listJson.pagination.total, 1);
  assert.equal(listJson.pagination.page, 1);

  // 2. Cross-tenant access to GET /api/monitors/:id/deployments returns 404
  const crossTenantRes = await request(`/monitors/${monitorAId}/deployments`, {
    role: "user",
    userId: userBId, // User B trying to access User A's monitor
  });
  assert.equal(crossTenantRes.status, 404);

  // 3. Invalid ObjectId format returns 400 validation error
  const invalidIdRes = await request(`/monitors/invalid-id/deployments`, {
    role: "user",
    userId: userAId,
  });
  assert.equal(invalidIdRes.status, 400);

  // 4. Retrieve single deployment event GET /api/monitors/:id/deployments/:deploymentId
  t.mock.method(DeploymentEvent, "findOne", ({ _id, owner, monitors }) => {
    if (
      String(_id) === deploymentEventId &&
      String(owner) === userAId &&
      String(monitors) === monitorAId
    ) {
      return {
        select: () => ({
          lean: async () => fakeEvents[0],
        }),
      };
    }
    return {
      select: () => ({
        lean: async () => null,
      }),
    };
  });

  const singleRes = await request(
    `/monitors/${monitorAId}/deployments/${deploymentEventId}`,
    {
      role: "user",
      userId: userAId,
    },
  );

  assert.equal(singleRes.status, 200);
  const singleJson = await singleRes.json();
  assert.equal(singleJson.success, true);
  assert.equal(singleJson.data.version, "v2.1.0");
  assert.equal(singleJson.data.id, deploymentEventId);
  assert.equal(singleJson.data.secret, undefined);
  assert.equal(singleJson.data.integration, undefined);

  // 5. Cross-tenant or non-existent deployment event returns 404
  const singleNotFoundRes = await request(
    `/monitors/${monitorAId}/deployments/64b000000000000000000099`,
    {
      role: "user",
      userId: userAId,
    },
  );
  assert.equal(singleNotFoundRes.status, 404);
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    server.close?.();
  }
  for (const h of process._getActiveHandles()) {
    if (h.unref) h.unref();
  }
  setTimeout(() => process.exit(0), 100);
});
