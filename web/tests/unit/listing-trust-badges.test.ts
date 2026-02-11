import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildListingTrustBadges,
  resolveListingSocialProof,
} from "@/lib/properties/listing-trust-badges";
import { ListingTrustBadges } from "@/components/properties/ListingTrustBadges";

void test("social proof buckets are privacy-safe ranges", () => {
  const proof = resolveListingSocialProof({
    savedCount: 72,
    viewCount: 560,
    popular: true,
  });

  assert.equal(proof.popular, true);
  assert.equal(proof.savedBucket, "Saved 50+");
  assert.equal(proof.viewBucket, "Viewed 500+");
});

void test("badge rules enforce precedence and cap", () => {
  const badges = buildListingTrustBadges({
    markers: { email_verified: true, phone_verified: true, bank_verified: false },
    createdAt: new Date().toISOString(),
    socialProof: {
      popular: true,
      savedBucket: "Saved 10+",
      viewBucket: "Viewed 100+",
    },
    maxBadges: 3,
    now: new Date(),
  });

  assert.deepEqual(
    badges.map((badge) => badge.key),
    ["verified", "popular", "new"]
  );
});

void test("identity pending appears only when verification is incomplete", () => {
  const badges = buildListingTrustBadges({
    markers: { email_verified: true, phone_verified: false, bank_verified: null },
    createdAt: null,
    socialProof: null,
  });

  assert.equal(badges[0]?.key, "identity_pending");
});

void test("listing trust badge component renders verified explainer", () => {
  const html = renderToStaticMarkup(
    React.createElement(ListingTrustBadges, {
      createdAt: new Date().toISOString(),
      trustMarkers: { email_verified: true, phone_verified: true, bank_verified: false },
      socialProof: { popular: true, savedBucket: null, viewBucket: null },
    })
  );

  assert.match(html, /Verified/);
  assert.match(html, /What does Verified mean\?/);
  assert.match(html, /\/help\/trust/);
});
