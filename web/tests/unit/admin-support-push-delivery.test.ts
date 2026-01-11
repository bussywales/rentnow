import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin support includes push delivery telemetry copy", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "admin",
    "support",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Recent delivery attempts"),
    "expected delivery attempts section"
  );
  assert.ok(
    contents.includes("No push delivery attempts recorded yet."),
    "expected delivery zero-state copy"
  );
});
