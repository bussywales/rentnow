import test from "node:test";
import assert from "node:assert/strict";
import { findCuratedListing } from "@/lib/agents/client-page-enquiry";
import type { Property } from "@/lib/types";
import {
  buildLeadInsertPayload,
  resolveLeadIntent,
  validateLeadProperty,
} from "@/lib/leads/lead-create";

test("findCuratedListing returns live curated listing", () => {
  const listings: Property[] = [
    { id: "a", status: "draft" },
    { id: "b", status: "live" },
  ] as Property[];

  assert.equal(findCuratedListing(listings, "b")?.id, "b");
  assert.equal(findCuratedListing(listings, "a"), null);
  assert.equal(findCuratedListing(listings, "missing"), null);
});

test("resolveLeadIntent supports rent listings", () => {
  assert.equal(resolveLeadIntent({ listingIntent: "rent" }), "ASK_QUESTION");
  assert.equal(resolveLeadIntent({ listingIntent: "buy" }), "BUY");
});

test("validateLeadProperty allows rent when configured", () => {
  const property = {
    id: "prop-1",
    owner_id: "agent-1",
    listing_intent: "rent",
    is_active: true,
    is_approved: true,
  };
  const result = validateLeadProperty(property, { allowListingIntent: "any" });
  assert.equal(result.ok, true);
});

test("lead insert payload uses property owner id", () => {
  const payload = buildLeadInsertPayload({
    property: {
      id: "prop-1",
      owner_id: "agent-99",
    },
    buyerId: "tenant-1",
    threadId: "thread-1",
    intent: "ASK_QUESTION",
    message: "Hello there",
    now: "2026-02-07T00:00:00Z",
  });
  assert.equal(payload.owner_id, "agent-99");
});
