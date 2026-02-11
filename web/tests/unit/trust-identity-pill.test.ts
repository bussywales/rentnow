import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getIdentityTrustLabel, isIdentityVerified } from "../../lib/trust-markers";

void test("identity trust label reflects verified state", () => {
  assert.equal(
    getIdentityTrustLabel({ email_verified: true, phone_verified: true }, { requireEmail: true }),
    "Identity verified"
  );
  assert.equal(
    getIdentityTrustLabel(
      { bank_verified: true },
      { requireEmail: true, requirePhone: false, requireBank: true }
    ),
    "Identity pending"
  );
  assert.equal(
    getIdentityTrustLabel(
      { email_verified: true, phone_verified: false },
      { requireEmail: true, requirePhone: true, requireBank: false }
    ),
    "Identity pending"
  );
  assert.equal(getIdentityTrustLabel(null), null);
  assert.equal(isIdentityVerified(null), false);
});

void test("property card uses listing trust badges by default", () => {
  const cardPath = path.join(process.cwd(), "components", "properties", "PropertyCard.tsx");
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(contents.includes("ListingTrustBadges"), "expected listing trust badges usage");
  assert.ok(!contents.includes("TrustIdentityPill"), "property card should not use identity pill directly");
  assert.ok(contents.includes('trustVariant = "public"'), "expected public trust variant default");
  assert.ok(contents.includes('trustVariant === "admin"'), "expected admin trust variant branch");
  assert.ok(!contents.includes("Email not verified"), "public card should not embed detailed copy");
});
