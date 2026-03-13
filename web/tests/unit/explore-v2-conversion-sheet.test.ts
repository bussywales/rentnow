import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExploreV2ConversionSheet } from "@/components/explore-v2/ExploreV2ConversionSheet";

void test("explore-v2 conversion sheet renders summary and actions when open", () => {
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2ConversionSheet, {
      open: true,
      onOpenChange: () => undefined,
      sheetId: "explore-v2-cta-sheet-listing-1",
      title: "Lekki Waterfront Apartment",
      locationLine: "Lagos, NG",
      priceClarity: {
        amount: "₦120,000",
        suffix: "/ night",
        note: "Excludes cleaning fee",
      },
      intentTag: "Shortlets",
      hasVideo: true,
      thumbnailSrc: "https://example.supabase.co/storage/v1/object/public/property-images/listing-1.jpg",
      trustCueCopy: "Instant confirmation available",
      primaryActionLabel: "Book",
      onPrimaryAction: () => undefined,
      detailsHref: "/properties/listing-1?source=explore_v0",
      onViewDetails: () => undefined,
      onShare: () => undefined,
      onSaveSurfaceCapture: () => undefined,
      viewerIsAuthenticated: true,
      saveToggle: {
        itemId: "listing-1",
        kind: "shortlet",
        href: "/properties/listing-1?source=explore_v0",
        title: "Lekki Waterfront Apartment",
        subtitle: "Lagos, NG",
        tag: "Shortlets",
        marketCountry: "NG",
        onToggle: () => undefined,
      },
    })
  );

  assert.match(html, /data-testid="explore-v2-cta-sheet"/);
  assert.match(html, /data-testid="explore-v2-conversion-sheet-content"/);
  assert.match(html, /data-testid="explore-v2-cta-summary-title"/);
  assert.match(html, /Lekki Waterfront Apartment/);
  assert.match(html, /data-testid="explore-v2-cta-summary-location"/);
  assert.match(html, /Lagos, NG/);
  assert.match(html, /data-testid="explore-v2-cta-summary-price"/);
  assert.match(html, /From/);
  assert.match(html, /data-testid="explore-v2-cta-price-amount"/);
  assert.match(html, /₦120,000/);
  assert.match(html, /data-testid="explore-v2-cta-price-suffix"/);
  assert.match(html, /\/ night/);
  assert.match(html, /data-testid="explore-v2-cta-price-note"/);
  assert.match(html, /Excludes cleaning fee/);
  assert.match(html, /data-testid="explore-v2-cta-trust-cue"/);
  assert.match(html, /Instant confirmation available/);
  assert.match(html, /data-testid="explore-v2-cta-continue"/);
  assert.match(html, />Book</);
  assert.match(html, /data-testid="explore-v2-cta-view-details"/);
  assert.match(html, /href="\/properties\/listing-1\?source=explore_v0"/);
  assert.match(html, /data-testid="explore-v2-cta-save-surface"/);
  assert.match(html, /data-testid="explore-v2-cta-share-action"/);
  assert.match(html, />Video</);
});

void test("explore-v2 conversion sheet hides trust cue row when not provided", () => {
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2ConversionSheet, {
      open: true,
      onOpenChange: () => undefined,
      sheetId: "explore-v2-cta-sheet-listing-1",
      title: "Lekki Waterfront Apartment",
      locationLine: "Lagos, NG",
      priceClarity: {
        amount: "₦120,000",
        suffix: "/ night",
        note: null,
      },
      intentTag: "Shortlets",
      hasVideo: false,
      thumbnailSrc: "https://example.supabase.co/storage/v1/object/public/property-images/listing-1.jpg",
      trustCueCopy: null,
      primaryActionLabel: "Book",
      onPrimaryAction: () => undefined,
      detailsHref: "/properties/listing-1?source=explore_v0",
      onViewDetails: () => undefined,
      onShare: () => undefined,
      onSaveSurfaceCapture: () => undefined,
      viewerIsAuthenticated: true,
      saveToggle: {
        itemId: "listing-1",
        kind: "shortlet",
        href: "/properties/listing-1?source=explore_v0",
        title: "Lekki Waterfront Apartment",
        subtitle: "Lagos, NG",
        tag: "Shortlets",
        marketCountry: "NG",
        onToggle: () => undefined,
      },
    })
  );

  assert.doesNotMatch(html, /data-testid="explore-v2-cta-trust-cue"/);
});

void test("explore-v2 conversion sheet renders variant CTA labels passed from the resolver", () => {
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2ConversionSheet, {
      open: true,
      onOpenChange: () => undefined,
      sheetId: "explore-v2-cta-sheet-listing-2",
      title: "Victoria Island Shortlet",
      locationLine: "Lagos, NG",
      priceClarity: {
        amount: "₦180,000",
        suffix: "/ night",
        note: null,
      },
      intentTag: "Shortlets",
      hasVideo: false,
      thumbnailSrc: null,
      trustCueCopy: null,
      primaryActionLabel: "Check availability",
      detailsActionLabel: "View details",
      onPrimaryAction: () => undefined,
      detailsHref: "/properties/listing-2?source=explore_v0",
      onViewDetails: () => undefined,
      onShare: () => undefined,
      onSaveSurfaceCapture: () => undefined,
      viewerIsAuthenticated: true,
      saveToggle: {
        itemId: "listing-2",
        kind: "shortlet",
        href: "/properties/listing-2?source=explore_v0",
        title: "Victoria Island Shortlet",
        subtitle: "Lagos, NG",
        tag: "Shortlets",
        marketCountry: "NG",
        onToggle: () => undefined,
      },
    })
  );

  assert.match(html, /Check availability/);
  assert.match(html, /View details/);
});
