import test from "node:test";
import assert from "node:assert/strict";
import { buildMoveReadyProviderLeadEmail } from "@/lib/email/templates/move-ready-provider-lead";

void test("provider lead email keeps requester contact details private", () => {
  const { html } = buildMoveReadyProviderLeadEmail({
    providerBusinessName: "Ready Clean",
    category: "end_of_tenancy_cleaning",
    marketCode: "NG",
    city: "Lagos",
    area: "Lekki",
    propertyTitle: "Ocean View Flat",
    preferredTimingText: "This week",
    contextNotes: "Need cleaning before relist.",
    requesterRole: "landlord",
    responseUrl: "https://example.com/respond",
  });

  assert.doesNotMatch(html, /Requester email/);
  assert.doesNotMatch(html, /Requester phone/);
  assert.doesNotMatch(html, /Contact preference/);
  assert.match(html, /Customer contact details stay protected/);
  assert.match(html, /Customer type/);
});
