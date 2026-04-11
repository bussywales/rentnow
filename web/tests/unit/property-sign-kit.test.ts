import test from "node:test";
import assert from "node:assert/strict";

import { buildPropertyShareRedirect } from "@/lib/sharing/property-share";
import {
  buildPropertySignKitShareUrl,
  formatPropertySignKitPrice,
  isPropertySignKitEligible,
  resolvePropertySignKitHeadline,
  sanitizePropertySignKitFileBase,
} from "@/lib/sharing/property-sign-kit";

void test("sign kit eligibility is limited to live approved active listings", () => {
  assert.equal(
    isPropertySignKitEligible({ status: "live", isApproved: true, isActive: true }),
    true
  );
  assert.equal(
    isPropertySignKitEligible({ status: "pending", isApproved: true, isActive: true }),
    false
  );
  assert.equal(
    isPropertySignKitEligible({ status: "live", isApproved: false, isActive: true }),
    false
  );
  assert.equal(
    isPropertySignKitEligible({ status: "live", isApproved: true, isActive: false }),
    false
  );
});

void test("tracked sign kit share url reuses the property share link and adds qr attribution", () => {
  const shareUrl = buildPropertySignKitShareUrl("https://www.propatyhub.com/share/property/token-123");
  const parsed = new URL(shareUrl);
  assert.equal(parsed.pathname, "/share/property/token-123");
  assert.equal(parsed.searchParams.get("source"), "qr_sign");
  assert.equal(parsed.searchParams.get("utm_source"), "qr");
  assert.equal(parsed.searchParams.get("utm_medium"), "offline_sign");
  assert.equal(parsed.searchParams.get("utm_campaign"), "listing_sign_kit");
});

void test("property share redirect preserves safe attribution params", () => {
  const redirectUrl = buildPropertyShareRedirect("listing-123", {
    source: "qr_sign",
    utm_source: "qr",
    utm_medium: "offline_sign",
    utm_campaign: "listing_sign_kit",
  });
  assert.equal(
    redirectUrl,
    "/properties/listing-123?shared=1&source=qr_sign&utm_source=qr&utm_medium=offline_sign&utm_campaign=listing_sign_kit"
  );
});

void test("sign kit helpers keep filenames and labels stable", () => {
  assert.equal(resolvePropertySignKitHeadline("sale"), "For sale");
  assert.equal(resolvePropertySignKitHeadline("rent"), "For rent");
  assert.equal(sanitizePropertySignKitFileBase("  Luxury Flat @ Lekki!  "), "luxury-flat-lekki");
  assert.match(formatPropertySignKitPrice(2500000, "NGN"), /^NGN|₦/);
});
