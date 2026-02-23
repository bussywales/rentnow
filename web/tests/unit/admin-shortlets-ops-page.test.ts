import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin shortlets page links to ops console", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "shortlets", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");
  assert.match(contents, /href="\/admin\/shortlets\/ops"/);
  assert.match(contents, /Ops console/);
});

void test("admin shortlets ops page renders dashboard shell", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "shortlets", "ops", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.match(contents, /Shortlets Ops/);
  assert.match(contents, /AdminShortletsOpsDashboard/);
  assert.match(contents, /Back to shortlet bookings/);
});

void test("admin shortlets ops dashboard fetches api and shows stable empty state copy", () => {
  const dashboardPath = path.join(
    process.cwd(),
    "components",
    "admin",
    "AdminShortletsOpsDashboard.tsx"
  );
  const contents = fs.readFileSync(dashboardPath, "utf8");

  assert.match(contents, /fetch\("\/api\/admin\/shortlets\/ops"/);
  assert.match(contents, /No runs yet/);
  assert.match(contents, /Refresh/);
});
