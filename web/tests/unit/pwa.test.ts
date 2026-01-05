import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import manifest from "../../app/manifest";

void test("pwa manifest exposes installable metadata", () => {
  const data = manifest();
  assert.equal(data.display, "standalone");
  assert.equal(data.start_url, "/");
  assert.ok(Array.isArray(data.icons));
  assert.ok(data.icons.length >= 2);
});

void test("service worker includes offline and skip-cache paths", () => {
  const swPath = path.join(process.cwd(), "public", "sw.js");
  const contents = fs.readFileSync(swPath, "utf8");

  const requiredPaths = [
    "/offline",
    "/api",
    "/auth",
    "/admin",
    "/dashboard",
    "/proxy/auth",
  ];

  for (const entry of requiredPaths) {
    assert.ok(
      contents.includes(entry),
      `expected service worker to reference ${entry}`
    );
  }
});
