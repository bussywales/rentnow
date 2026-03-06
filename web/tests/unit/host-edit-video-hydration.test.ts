import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host edit loader keeps property_videos when hydrating listing state", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "host",
    "properties",
    "[id]",
    "edit",
    "page.tsx"
  );
  const source = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    source.includes("property_videos: typed.property_videos ?? null"),
    "expected list-loader mapping to retain property_videos"
  );
  assert.ok(
    source.includes("property_videos: data.property_videos ?? null"),
    "expected detail-loader mapping to retain property_videos"
  );
});
