import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildPropertyShareRedirect } from "@/lib/sharing/property-share";
import {
  buildPropertySignKitPdf,
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

void test("sign kit pdf generation normalizes unsupported unicode punctuation in dynamic text", async () => {
  const bytes = await buildPropertySignKitPdf({
    template: "sign",
    qrPngDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0xQAAAAASUVORK5CYII=",
    headline: "For rent",
    title: "Cozy 2‑bed flat in Lekki Phase 1",
    locationLabel: 'Lekki Phase 2, Lagos – "Waterfront"',
    priceLabel: "NGN 200,000",
    trackedShareUrl: "https://www.propatyhub.com/share/property/token-123",
  });

  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.byteLength > 0);
});

void test("sign kit pdf generation supports hiding price without breaking export composition", async () => {
  const signBytes = await buildPropertySignKitPdf({
    template: "sign",
    qrPngDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0xQAAAAASUVORK5CYII=",
    headline: "For sale",
    title: "Elegant 4-bed mansion in Ikorodu",
    locationLabel: "Ikorodu, Lagos, Nigeria",
    priceLabel: "NGN 46,000,000",
    showPrice: false,
    trackedShareUrl: "https://www.propatyhub.com/share/property/token-123",
  });

  const flyerBytes = await buildPropertySignKitPdf({
    template: "flyer",
    qrPngDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0xQAAAAASUVORK5CYII=",
    headline: "For sale",
    title: "Elegant 4-bed mansion in Ikorodu",
    locationLabel: "Ikorodu, Lagos, Nigeria",
    priceLabel: "NGN 46,000,000",
    showPrice: false,
    trackedShareUrl: "https://www.propatyhub.com/share/property/token-123",
  });

  assert.ok(signBytes.byteLength > 0);
  assert.ok(flyerBytes.byteLength > 0);
});

void test("sign kit export copy stays property-first and avoids utility-style collateral text", () => {
  const source = readFileSync(
    "/Users/olubusayoadewale/rentnow/web/lib/sharing/property-sign-kit.ts",
    "utf8"
  );

  assert.match(source, /Scan for full details/);
  assert.match(source, /Open the live listing on PropatyHub/);
  assert.doesNotMatch(source, /Tracked through a controlled PropatyHub share link/);
  assert.doesNotMatch(source, /Tracked through a PropatyHub share link/);
  assert.doesNotMatch(source, /Designed for handouts, counters, and reception desks/);
  assert.doesNotMatch(source, /Display where passers-by can scan comfortably from a short distance/);
  assert.doesNotMatch(source, /ASKING PRICE/);
  assert.doesNotMatch(source, /Premium listing card/);
});
