import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getIdentityTrustLabel } from "@/lib/trust-markers";

void test("public property page uses identity trust pill instead of detailed badges", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "[id]", "page.tsx");
  const page = fs.readFileSync(pagePath, "utf8");

  assert.ok(page.includes("TrustIdentityPill"), "expected identity pill on property page");
  assert.ok(!page.includes("TrustBadges"), "public property page should not render TrustBadges");
  assert.ok(!page.includes("TrustReliability"), "public property page should not render TrustReliability");
  assert.ok(!page.includes("Email not verified"), "public page should not embed detailed copy");
  assert.ok(!page.includes("Phone not verified"), "public page should not embed detailed copy");
  assert.ok(!page.includes("Bank not verified"), "public page should not embed detailed copy");
  assert.equal(getIdentityTrustLabel(null), "Identity pending");
});
