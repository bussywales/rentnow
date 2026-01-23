import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";

void test("admin review microcopy exposes required keys", () => {
  assert.ok(ADMIN_REVIEW_COPY.headerTitle);
  assert.ok(ADMIN_REVIEW_COPY.headerSubtitle);
  assert.ok(ADMIN_REVIEW_COPY.list.emptyTitle);
  assert.ok(ADMIN_REVIEW_COPY.list.columns.title);
  assert.ok(ADMIN_REVIEW_COPY.drawer.overview);
  assert.ok(ADMIN_REVIEW_COPY.drawer.media);
  assert.ok(ADMIN_REVIEW_COPY.drawer.location);
  assert.ok(ADMIN_REVIEW_COPY.drawer.notes);
});
