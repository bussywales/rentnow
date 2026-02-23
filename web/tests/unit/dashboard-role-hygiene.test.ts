import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("dashboard layout keeps tenant fallback and shared workspace shell for host roles", () => {
  const layoutPath = path.join(process.cwd(), "app", "dashboard", "layout.tsx");
  const contents = fs.readFileSync(layoutPath, "utf8");

  assert.ok(
    contents.includes("const isTenant = normalizedRole === \"tenant\""),
    "expected dashboard layout to identify tenant role before rendering host shell"
  );
  assert.ok(
    contents.includes("if (isTenant)"),
    "expected tenant-specific fallback to bypass workspace sidebar shell"
  );
  assert.ok(
    contents.includes("WorkspaceShell"),
    "expected host/agent routes to render inside the shared workspace shell"
  );
});
