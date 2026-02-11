import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("dashboard routes admin to admin console", () => {
  const dashboardPath = path.join(process.cwd(), "app", "dashboard", "page.tsx");
  const contents = fs.readFileSync(dashboardPath, "utf8");
  assert.ok(contents.includes('role === "admin"'), "admin redirect should be explicit");
  assert.ok(contents.includes('redirect("/admin")'), "admin dashboard should land in /admin");
  assert.ok(contents.includes('redirect("/home")'), "dashboard should route agent/landlord to /home");
});

void test("admin route remains admin-only", () => {
  const adminPath = path.join(process.cwd(), "app", "admin", "page.tsx");
  const contents = fs.readFileSync(adminPath, "utf8");
  assert.ok(contents.includes('profile?.role !== "admin"'), "admin page enforces admin guard");
});
