import test from "node:test";
import assert from "node:assert/strict";
import { deriveCtaState } from "@/components/viewings/RequestViewingButton";

void test("CTA allows re-request after decline", () => {
  const state = deriveCtaState(
    { id: "1", status: "declined", created_at: "2026-01-01T00:00:00Z" },
    false
  );
  assert.equal(state.disabled, false);
  assert.match(state.label.toLowerCase(), /request viewing/);
});
