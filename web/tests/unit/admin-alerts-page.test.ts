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

void test("admin alerts page hosts temporary Sentry verification controls on the admin-only surface", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "alerts", "page.tsx");
  const componentPath = path.join(
    process.cwd(),
    "components",
    "admin",
    "AdminAlertsOpsActions.tsx"
  );

  const pageContents = fs.readFileSync(pagePath, "utf8");
  const componentContents = fs.readFileSync(componentPath, "utf8");

  assert.ok(pageContents.includes("<AdminAlertsOpsActions"));
  assert.ok(componentContents.includes("Send test Sentry server event"));
  assert.ok(componentContents.includes("Send test Sentry client event"));
  assert.ok(componentContents.includes("Temporary Sentry verification tools for admin ops only"));
});
