import test from "node:test";
import assert from "node:assert/strict";
import { deriveCtaState } from "@/components/viewings/RequestViewingButton";

void test("CTA enabled for declined latest", () => {
  const state = deriveCtaState({
    id: "1",
    status: "declined",
    created_at: "2026-01-01T00:00:00Z",
  });
  assert.equal(state.disabled, false);
  assert.match(state.label.toLowerCase(), /request viewing/);
});

void test("CTA label remains request viewing for all statuses", () => {
  const statuses = ["pending", "approved", "proposed", "declined", "no_show", "requested"];
  for (const status of statuses) {
    const state = deriveCtaState({
      id: "x",
      status,
      created_at: "2026-01-01T00:00:00Z",
    });
    assert.match(state.label.toLowerCase(), /request viewing/);
  }
});
