import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import manifest from "../../app/manifest";

void test("pwa manifest exposes installable metadata", () => {
  const data = manifest();
  assert.equal(data.display, "standalone");
  assert.equal(data.start_url, "/?source=pwa");
  assert.equal(data.scope, "/");
  assert.ok(Array.isArray(data.icons));
  assert.ok(data.icons.length >= 3);
  const sizes = new Set(data.icons.map((icon) => icon.sizes));
  const srcs = new Set(data.icons.map((icon) => icon.src));
  assert.ok(sizes.has("192x192"), "expected a 192x192 app icon");
  assert.ok(sizes.has("512x512"), "expected a 512x512 app icon");
  assert.ok(srcs.has("/icons/app-icon-192.png"), "expected padded 192 icon path");
  assert.ok(srcs.has("/icons/app-icon-512.png"), "expected padded 512 icon path");
  assert.ok(srcs.has("/icons/app-icon-512-maskable.png"), "expected padded maskable icon path");
  assert.ok(srcs.has("/apple-touch-icon.png"), "expected apple touch icon path");
  assert.ok(
    data.icons.some((icon) =>
      String(icon.purpose ?? "")
        .split(/\s+/)
        .includes("maskable")
    ),
    "expected at least one maskable icon"
  );
});

void test("service worker includes offline and skip-cache paths", () => {
  const swPath = path.join(process.cwd(), "public", "sw.js");
  const contents = fs.readFileSync(swPath, "utf8");

  const requiredPaths = ["/offline", "/api", "/auth", "/admin", "/dashboard", "/proxy/auth"];

  for (const entry of requiredPaths) {
    assert.ok(
      contents.includes(entry),
      `expected service worker to reference ${entry}`
    );
  }

  const skipMatch = contents.match(/const SKIP_CACHE_PATHS = \[([\s\S]*?)\];/);
  assert.ok(skipMatch, "expected service worker to define SKIP_CACHE_PATHS");
  const skipList = Array.from(skipMatch[1].matchAll(/"([^"]+)"/g)).map(
    (match) => match[1]
  );

  assert.ok(
    !skipList.includes("/properties"),
    "expected /properties to remain cache-eligible"
  );
  assert.ok(
    contents.includes('addEventListener("push"'),
    "expected service worker to register push handlers"
  );
});
