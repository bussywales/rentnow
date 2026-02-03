import test from "node:test";
import assert from "node:assert/strict";
import { buildTrustCues, isNewListing } from "@/lib/trust-cues";

void test("trust cues include verified host and new listing", () => {
  const now = new Date();
  const createdAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const cues = buildTrustCues({
    markers: { email_verified: true, phone_verified: true },
    fastResponder: false,
    createdAt,
    now,
  });
  const labels = cues.map((cue) => cue.label);
  assert.ok(labels.includes("Verified host"));
  assert.ok(labels.includes("New listing"));
});

void test("trust cues include fast responder only when true", () => {
  const cues = buildTrustCues({
    markers: null,
    fastResponder: true,
    createdAt: null,
  });
  assert.equal(cues.length, 1);
  assert.equal(cues[0]?.label, "Fast responder");
});

void test("new listing helper is resilient to missing dates", () => {
  assert.equal(isNewListing(undefined), false);
  assert.equal(isNewListing(null), false);
  assert.equal(isNewListing("not-a-date"), false);
});
