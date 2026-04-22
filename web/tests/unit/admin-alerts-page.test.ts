import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin alerts page enforces admin guard", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "alerts", "page.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("/forbidden?reason=role"));
  assert.ok(contents.includes("/auth/required?redirect=/admin/alerts&reason=auth"));
});

void test("admin alerts page surfaces monitoring snapshot summary for operators", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "alerts", "page.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("Monitoring snapshot"));
  assert.ok(contents.includes("Release, database, schema, and Sentry readiness grouped for fast triage."));
  assert.ok(contents.includes("diag.monitoring.overallLabel"));
  assert.ok(contents.includes("diag.monitoring.runtimeEnvironment"));
});

void test("admin alerts page no longer renders temporary sentry verification controls", () => {
  const componentPath = path.join(
    process.cwd(),
    "components",
    "admin",
    "AdminAlertsOpsActions.tsx"
  );

  const componentContents = fs.readFileSync(componentPath, "utf8");

  assert.ok(!componentContents.includes("Send test Sentry server event"));
  assert.ok(!componentContents.includes("Send test Sentry client event"));
  assert.ok(!componentContents.includes("Temporary Sentry verification tools for admin ops only"));
  assert.ok(!componentContents.includes("/api/admin/sentry/test"));
});

void test("temporary admin sentry test route has been removed", () => {
  const routePath = path.join(
    process.cwd(),
    "app",
    "api",
    "admin",
    "sentry",
    "test",
    "route.ts"
  );

  assert.equal(fs.existsSync(routePath), false);
});
