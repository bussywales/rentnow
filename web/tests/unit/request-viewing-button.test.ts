import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCtaState,
  resolveViewingRequestErrorMessage,
} from "@/components/viewings/RequestViewingButton";

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

void test("viewing request error copy maps auth and role responses", () => {
  assert.equal(resolveViewingRequestErrorMessage(401, { error: "Unauthorized" }), "Please log in to request a viewing.");
  assert.equal(
    resolveViewingRequestErrorMessage(403, { error: "Forbidden" }),
    "Viewing requests are currently available from tenant accounts."
  );
});

void test("viewing request error copy preserves explicit API messages", () => {
  assert.equal(
    resolveViewingRequestErrorMessage(400, {
      error: "One or more preferred times are not available for this property",
    }),
    "One or more preferred times are not available for this property"
  );
});
