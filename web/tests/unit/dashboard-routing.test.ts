import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("dashboard routes admin to admin console", () => {
  const dashboardPath = path.join(process.cwd(), "app", "dashboard", "page.tsx");
  const contents = fs.readFileSync(dashboardPath, "utf8");
  assert.ok(contents.includes("resolvePostLoginRedirect"), "dashboard should use shared post-login redirect resolver");
  assert.ok(contents.includes("redirect(resolvePostLoginRedirect({ role }))"), "dashboard should redirect via shared resolver");
});

void test("admin route remains admin-only", () => {
  const adminPath = path.join(process.cwd(), "app", "admin", "page.tsx");
  const contents = fs.readFileSync(adminPath, "utf8");
  assert.ok(contents.includes('profile?.role !== "admin"'), "admin page enforces admin guard");
});
