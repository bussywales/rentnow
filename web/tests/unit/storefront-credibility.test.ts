import test from "node:test";
import assert from "node:assert/strict";
import { buildStorefrontCredibilityChips } from "@/lib/agents/storefront-credibility";

void test("buildStorefrontCredibilityChips returns expected chip copy", () => {
  const chips = buildStorefrontCredibilityChips({
    memberSince: "2022-03-04T00:00:00.000Z",
    liveListingsCount: 2,
    enquiriesCount: 1,
    activeThisWeek: true,
  });

  assert.deepEqual(chips, [
    "Member since 2022",
    "2 live listings",
    "1 enquiry received",
    "Active this week",
  ]);
});

void test("buildStorefrontCredibilityChips omits empty data", () => {
  const chips = buildStorefrontCredibilityChips({
    memberSince: null,
    liveListingsCount: 0,
    enquiriesCount: null,
    activeThisWeek: false,
  });

  assert.deepEqual(chips, []);
});
