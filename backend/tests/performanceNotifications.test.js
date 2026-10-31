import test from "node:test";
import assert from "node:assert/strict";
import Notification from "../src/models/Notification.js";
import UserPreference from "../src/models/UserPreference.js";
import {
  createNotification,
  dispatchNotificationDigests,
} from "../src/services/notification.service.js";

const preferenceDocument = (notifications) => ({
  notifications: { toObject: () => notifications },
});

test("performance notification respects in-app and email preferences", async (t) => {
  t.mock.method(UserPreference, "getOrCreateForUser", async () =>
    preferenceDocument({
      inApp: { performanceAlerts: false },
      email: { enabled: false, performanceAlerts: false },
      frequency: "immediate",
    }),
  );
  let createCalls = 0;
  t.mock.method(Notification, "create", async () => {
    createCalls += 1;
    return {};
  });

  const result = await createNotification({
    ownerId: "user-1",
    type: "performance_degraded",
    title: "Performance degradation detected",
    message: "Response times are elevated.",
  });

  assert.equal(result, null);
  assert.equal(createCalls, 0);
});

test("performance events are eligible for digest delivery when enabled", async (t) => {
  let capturedFilter;
  t.mock.method(UserPreference, "find", () => ({
    select() {
      return this;
    },
    lean: async () => [
      {
        user: "user-1",
        notifications: {
          frequency: "daily",
          email: { enabled: true, performanceAlerts: true },
        },
      },
    ],
  }));
  t.mock.method(Notification, "find", (filter) => {
    capturedFilter = filter;
    return {
      sort() {
        return this;
      },
      limit: async () => [],
    };
  });

  await dispatchNotificationDigests();

  assert.ok(capturedFilter.type.$in.includes("performance_degraded"));
  assert.ok(capturedFilter.type.$in.includes("performance_recovered"));
});
