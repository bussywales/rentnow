import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReliabilityItems,
  buildTrustBadges,
  isAdvertiserIdentityPending,
  isAdvertiserVerified,
} from "../../lib/trust-markers";

void test("buildTrustBadges returns empty when markers missing", () => {
  assert.deepEqual(buildTrustBadges(null), []);
  assert.deepEqual(buildTrustBadges(undefined), []);
});

void test("buildTrustBadges reports verified and unverified states", () => {
  const badges = buildTrustBadges({
    email_verified: true,
    phone_verified: false,
    bank_verified: true,
  });
  assert.equal(badges.length, 3);
  assert.equal(badges[0].label, "Email verified");
  assert.equal(badges[1].label, "Phone not verified");
  assert.equal(badges[2].label, "Bank verified");
});

void test("buildReliabilityItems ignores unknown values", () => {
  const items = buildReliabilityItems({
    reliability_power: "good",
    reliability_water: "unknown",
    reliability_internet: "fair",
  });
  assert.deepEqual(
    items.map((item) => `${item.label}:${item.value}`),
    ["Power:Good", "Internet:Fair"]
  );
});

void test("email-only requirement marks advertiser as verified when email is verified", () => {
  const markers = { email_verified: true, phone_verified: false, bank_verified: false };
  const requirements = { requireEmail: true, requirePhone: false, requireBank: false };
  assert.equal(isAdvertiserVerified(markers, requirements), true);
  assert.equal(isAdvertiserIdentityPending(markers, requirements), false);
});

void test("email+phone requirement marks advertiser as identity pending when only email is verified", () => {
  const markers = { email_verified: true, phone_verified: false, bank_verified: false };
  const requirements = { requireEmail: true, requirePhone: true, requireBank: false };
  assert.equal(isAdvertiserVerified(markers, requirements), false);
  assert.equal(isAdvertiserIdentityPending(markers, requirements), true);
});

void test("disabled phone and bank requirements do not force identity pending", () => {
  const markers = { email_verified: true, phone_verified: false, bank_verified: false };
  const requirements = { requireEmail: true, requirePhone: false, requireBank: false };
  assert.equal(isAdvertiserIdentityPending(markers, requirements), false);
});
