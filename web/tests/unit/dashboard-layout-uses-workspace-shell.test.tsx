import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("dashboard layout uses workspace shell for landlord and agent roles", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /WorkspaceShell/);
  assert.match(source, /if \(isTenant\)/);
  assert.match(source, /role=\{normalizedRole\}/);
  assert.match(source, /title=\{workspaceTitle\}/);
  assert.match(source, /DashboardNavPills/);
});
