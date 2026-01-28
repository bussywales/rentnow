import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("dashboard keeps admin on dashboard", () => {
  const dashboardPath = path.join(process.cwd(), "app", "dashboard", "page.tsx");
  const contents = fs.readFileSync(dashboardPath, "utf8");
  assert.ok(!contents.includes('role === "admin"'), "admin redirect to /admin should be removed");
  assert.ok(contents.includes("/dashboard/analytics"), "dashboard should route to analytics workspace");
});

void test("admin route remains admin-only", () => {
  const adminPath = path.join(process.cwd(), "app", "admin", "page.tsx");
  const contents = fs.readFileSync(adminPath, "utf8");
  assert.ok(contents.includes('profile?.role !== "admin"'), "admin page enforces admin guard");
});
