import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORT_CANNED_REPLIES,
  buildSupportCannedReplyDraft,
  getSupportCannedReplyTemplate,
} from "@/lib/support/canned-replies";

void test("support canned replies exposes the required starter template ids", () => {
  const ids = SUPPORT_CANNED_REPLIES.map((template) => template.id).sort();
  assert.deepEqual(ids, [
    "need_more_details",
    "received_request",
    "refund_billing_guidance",
    "resolved_next_steps",
    "safety_escalation_guidance",
  ]);
});

void test("support canned replies define non-empty labels, subjects, and bodies", () => {
  for (const template of SUPPORT_CANNED_REPLIES) {
    assert.ok(template.label.trim().length > 0);
    assert.ok(template.subject.trim().length > 0);
    assert.ok(template.body.trim().length > 0);
  }
});

void test("buildSupportCannedReplyDraft resolves placeholders for ticket and requester name", () => {
  const draft = buildSupportCannedReplyDraft({
    templateId: "received_request",
    ticketId: "REQ-123",
    requesterName: "Ada",
  });
  assert.ok(draft);
  assert.match(draft.subject, /REQ-123/);
  assert.match(draft.body, /Ada/);
});

void test("getSupportCannedReplyTemplate returns null for unknown ids", () => {
  const template = getSupportCannedReplyTemplate("unknown");
  assert.equal(template, null);
});
