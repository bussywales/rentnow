import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host dashboard content no longer renders workspace route pills", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostDashboardContent.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /Use sidebar for primary navigation/);
  assert.doesNotMatch(source, /setWorkspaceSection\("listings"\)/);
  assert.doesNotMatch(source, /setWorkspaceSection\("bookings"\)/);
});

void test("dashboard layout does not render top-level dashboard pills", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.doesNotMatch(source, /DashboardNavPills/);
  assert.match(source, /WorkspaceShell/);
});
