import test from "node:test";
import assert from "node:assert/strict";
import { pickNextId } from "@/components/admin/AdminReviewShell";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

const sample: AdminReviewListItem[] = [
  { id: "a", title: "A", hostName: "Host", updatedAt: null, readiness: { score: 0, tier: "Good", issues: [] }, locationQuality: "ok", photoCount: 0, hasVideo: false } as AdminReviewListItem,
  { id: "b", title: "B", hostName: "Host", updatedAt: null, readiness: { score: 0, tier: "Good", issues: [] }, locationQuality: "ok", photoCount: 0, hasVideo: false } as AdminReviewListItem,
];

void test("pickNextId returns first when none removed", () => {
  assert.equal(pickNextId(sample, null), "a");
});

void test("pickNextId skips removed id and advances", () => {
  assert.equal(pickNextId(sample, "a"), "b");
  assert.equal(pickNextId(sample, "b"), "a");
});
