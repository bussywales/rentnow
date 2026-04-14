import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin stay reviews page exposes summary, filters, and review context links", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "reviews", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /Stay reviews/);
  assert.match(source, /data-testid="admin-reviews-page"/);
  assert.match(source, /data-testid="admin-reviews-summary"/);
  assert.match(source, /data-testid="admin-reviews-filters"/);
  assert.match(source, /data-testid="admin-reviews-table"/);
  assert.match(source, /data-testid="admin-review-row"/);
  assert.match(source, /Booking context/);
  assert.match(source, /Property/);
  assert.match(source, /Public profile/);
  assert.match(source, /Awaiting host response/);
});
