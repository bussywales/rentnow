import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequestChangesMessage,
  normalizeReasons,
  parseRejectionReason,
  validateRequestChangesPayload,
} from "@/lib/admin/admin-review-rubric";

void test("normalizeReasons filters unknown codes", () => {
  assert.deepEqual(normalizeReasons(["needs_location", "unknown"]), ["needs_location"]);
});

void test("buildRequestChangesMessage includes reason labels", () => {
  const msg = buildRequestChangesMessage(["needs_location", "needs_cover"]);
  assert.ok(msg.includes("Location is unclear"));
  assert.ok(msg.includes("Set a cover photo"));
});

void test("validateRequestChangesPayload requires reason or message", () => {
  const invalid = validateRequestChangesPayload([], "");
  assert.equal(invalid.ok, false);
  const valid = validateRequestChangesPayload(["needs_location"], "");
  assert.equal(valid.ok, true);
  assert.ok(valid.message?.length);
});

void test("parseRejectionReason handles structured and legacy", () => {
  const structured = parseRejectionReason(
    JSON.stringify({
      type: "admin_review_request_changes",
      reasons: ["needs_cover"],
      message: "Set cover",
      reviewed_at: "2024-01-01T00:00:00Z",
      reviewed_by: "admin",
    })
  );
  assert.equal(structured.type, "admin_review_request_changes");
  assert.deepEqual(structured.reasons, ["needs_cover"]);
  assert.equal(structured.message, "Set cover");

  const legacy = parseRejectionReason("plain text");
  assert.equal(legacy.type, "legacy");
  assert.equal(legacy.message, "plain text");
});
