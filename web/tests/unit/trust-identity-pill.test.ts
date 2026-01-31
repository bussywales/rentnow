import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getIdentityTrustLabel, isIdentityVerified } from "../../lib/trust-markers";

void test("identity trust label reflects verified state", () => {
  assert.equal(
    getIdentityTrustLabel({ email_verified: true, phone_verified: true }),
    "Identity verified"
  );
  assert.equal(
    getIdentityTrustLabel({ bank_verified: true }),
    "Identity pending"
  );
  assert.equal(
    getIdentityTrustLabel({ email_verified: true, phone_verified: false }),
    "Identity pending"
  );
  assert.equal(getIdentityTrustLabel(null), "Identity pending");
  assert.equal(isIdentityVerified(null), false);
});

void test("property card uses identity trust pill by default", () => {
  const cardPath = path.join(process.cwd(), "components", "properties", "PropertyCard.tsx");
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(contents.includes("TrustIdentityPill"), "expected identity trust pill usage");
  assert.ok(contents.includes('trustVariant = "public"'), "expected public trust variant default");
  assert.ok(contents.includes('trustVariant === "admin"'), "expected admin trust variant branch");
  assert.ok(!contents.includes("Email not verified"), "public card should not embed detailed copy");
});
