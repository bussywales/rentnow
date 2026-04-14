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
  assert.ok(
    adminContents.includes("href=\"/admin/analytics\""),
    "expected link to /admin/analytics in overview"
  );
  assert.ok(
    adminContents.includes("href=\"/admin/requests\""),
    "expected link to /admin/requests in overview"
  );
  assert.ok(
    adminContents.includes("href=\"/admin/support\""),
    "expected link to /admin/support in overview"
  );
  assert.ok(
    adminContents.includes("href=\"/admin/listing-transfers\""),
    "expected link to /admin/listing-transfers in overview"
  );
  assert.ok(
    adminContents.includes("href=\"/admin/reviews\""),
    "expected link to /admin/reviews in overview"
  );
  assert.ok(
    adminContents.includes("Analytics"),
    "expected Analytics label in admin control panel links"
  );
  assert.ok(
    adminContents.includes("Requests"),
    "expected Requests label in admin control panel links"
  );
  assert.ok(
    adminContents.includes("Support requests"),
    "expected Support requests label in admin control panel links"
  );
  assert.ok(
    adminContents.includes("Listing transfers"),
    "expected Listing transfers label in admin control panel links"
  );
  assert.ok(
    adminContents.includes("Stay reviews"),
    "expected Stay reviews label in admin control panel links"
  );
  assert.ok(
    !adminContents.includes("href=\"/admin/insights\""),
    "expected legacy /admin/insights control panel shortcut to be removed"
  );

  const listingsPath = path.join(process.cwd(), "app", "admin", "listings", "page.tsx");
  const listingsContents = fs.readFileSync(listingsPath, "utf8");
  assert.ok(
    listingsContents.includes("Listings registry"),
    "expected listings registry heading"
  );
});
