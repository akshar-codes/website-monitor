import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import oauthRoutes from "../src/routes/oauth.routes.js";

test("OAuth provider discovery is public and exposes only enabled flags", async (t) => {
  const app = express();
  app.use("/auth", oauthRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/auth/providers`,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body.data.providers).sort(), [
    "github",
    "google",
  ]);
  assert.ok(
    Object.values(body.data.providers).every(
      (enabled) => typeof enabled === "boolean",
    ),
  );
  assert.ok(!JSON.stringify(body).includes("clientSecret"));
});
