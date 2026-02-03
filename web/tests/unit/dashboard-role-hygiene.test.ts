import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("dashboard layout hides listing nav for non-listing roles", () => {
  const layoutPath = path.join(process.cwd(), "app", "dashboard", "layout.tsx");
  const contents = fs.readFileSync(layoutPath, "utf8");

  assert.ok(
    contents.includes("canManageListings"),
    "expected dashboard layout to use canManageListings for My listings"
  );
  assert.ok(
    contents.includes("showMyProperties"),
    "expected My listings link to be conditionally rendered"
  );
  assert.ok(
    contents.includes("/dashboard/analytics"),
    "expected analytics link to be gated with listing roles"
  );
});
