import test from "node:test";
import assert from "node:assert/strict";
import { HOST_FIX_REQUEST_COPY } from "@/lib/admin/host-fix-request-microcopy";
import { REVIEW_REASONS } from "@/lib/admin/admin-review-rubric";

void test("host fix request microcopy exposes required keys", () => {
  assert.ok(HOST_FIX_REQUEST_COPY.panel.title);
  assert.ok(HOST_FIX_REQUEST_COPY.panel.subtitle);
  assert.ok(HOST_FIX_REQUEST_COPY.panel.resubmitButton);
  assert.ok(HOST_FIX_REQUEST_COPY.panel.confirmTitle);
  assert.ok(HOST_FIX_REQUEST_COPY.actions.photos);
  assert.ok(HOST_FIX_REQUEST_COPY.reasons.fallback);
});

void test("all admin review reasons map or fallback", () => {
  const codes = REVIEW_REASONS.map((r) => r.code);
  for (const code of codes) {
    assert.ok(
      HOST_FIX_REQUEST_COPY.reasons[code as keyof typeof HOST_FIX_REQUEST_COPY.reasons] ||
        HOST_FIX_REQUEST_COPY.reasons.fallback
    );
  }
});
