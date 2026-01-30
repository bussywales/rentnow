import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin review mobile detail route renders inspector markers", () => {
  const root = process.cwd();
  const pagePath = path.join(root, "app", "admin", "review", "[listingId]", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");
  assert.ok(
    contents.includes("admin-review-mobile-detail"),
    "expected mobile detail test id"
  );
  assert.ok(
    contents.includes("AdminReviewMobileDetailPanel"),
    "expected mobile detail panel usage"
  );
  assert.ok(
    contents.includes("listingId") && contents.includes("await params"),
    "expected params to resolve listingId"
  );
});
