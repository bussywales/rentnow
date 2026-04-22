import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin alerts ops actions expose temporary Sentry verification button copy", () => {
  const componentPath = path.join(
    process.cwd(),
    "components",
    "admin",
    "AdminAlertsOpsActions.tsx"
  );
  const contents = fs.readFileSync(componentPath, "utf8");

  assert.ok(contents.includes('fetch("/api/admin/sentry/test"'));
  assert.ok(contents.includes("Send test Sentry server event"));
  assert.ok(contents.includes("Send test Sentry client event"));
  assert.ok(contents.includes("captureClientBoundaryException"));
});
