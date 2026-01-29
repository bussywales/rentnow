import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin overview + listings registry are wired to new workspaces", () => {
  const adminPath = path.join(process.cwd(), "app", "admin", "page.tsx");
  const adminContents = fs.readFileSync(adminPath, "utf8");
  assert.ok(
    adminContents.includes("Control panel"),
    "expected overview control panel heading"
  );
  assert.ok(
    adminContents.includes("href=\"/admin/review\""),
    "expected link to /admin/review in overview"
  );
  assert.ok(
    adminContents.includes("href=\"/admin/listings\""),
    "expected link to /admin/listings in overview"
  );

  const listingsPath = path.join(process.cwd(), "app", "admin", "listings", "page.tsx");
  const listingsContents = fs.readFileSync(listingsPath, "utf8");
  assert.ok(
    listingsContents.includes("Listings registry"),
    "expected listings registry heading"
  );
});
