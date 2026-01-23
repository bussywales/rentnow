import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDismissKey,
  buildFixRequestItems,
  mapReasonToItem,
  parseRejectionReason,
  shouldShowFixRequestPanel,
} from "@/lib/admin/host-fix-request";

void test("parseRejectionReason handles structured payload", () => {
  const payload = JSON.stringify({
    type: "admin_review_request_changes",
    reasons: ["needs_cover"],
    message: "Please set a cover",
  });
  const parsed = parseRejectionReason(payload);
  assert.equal(parsed.isStructured, true);
  assert.deepEqual(parsed.reasons, ["needs_cover"]);
  assert.equal(parsed.message, "Please set a cover");
});

void test("parseRejectionReason falls back to legacy string", () => {
  const parsed = parseRejectionReason("legacy message");
  assert.equal(parsed.isStructured, false);
  assert.deepEqual(parsed.reasons, []);
  assert.equal(parsed.message, "legacy message");
});

void test("mapReasonToItem maps known codes", () => {
  const item = mapReasonToItem("needs_location");
  assert.equal(item.action.kind, "location");
  assert.ok(item.label.toLowerCase().includes("location"));
});

void test("buildFixRequestItems falls back when no reasons", () => {
  const items = buildFixRequestItems([]);
  assert.ok(items.length >= 1);
});

void test("buildDismissKey is deterministic", () => {
  const parsed = { reasons: ["needs_cover"], message: "msg", isStructured: true };
  const key1 = buildDismissKey("123", parsed);
  const key2 = buildDismissKey("123", parsed);
  assert.equal(key1, key2);
});

void test("shouldShowFixRequestPanel respects status and dismissal", () => {
  assert.equal(shouldShowFixRequestPanel("pending", false), false);
  assert.equal(shouldShowFixRequestPanel("changes_requested", false), true);
  assert.equal(shouldShowFixRequestPanel("changes_requested", true), false);
});
