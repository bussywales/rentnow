import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ExploreV2ConversionSheet,
  resolveExploreV2ConversionQuickActionLabel,
} from "@/components/explore-v2/ExploreV2ConversionSheet";

void test("explore-v2 conversion sheet renders summary and actions when open", () => {
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2ConversionSheet, {
      open: true,
      onOpenChange: () => undefined,
      sheetId: "explore-v2-cta-sheet-listing-1",
      title: "Lekki Waterfront Apartment",
      locationLine: "Lagos, NG",
      pricePrimary: "From ₦120,000/night",
      intentTag: "Shortlets",
      hasVideo: true,
      thumbnailSrc: "https://example.supabase.co/storage/v1/object/public/property-images/listing-1.jpg",
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
  assert.match(html, /From ₦120,000\/night/);
  assert.match(html, /data-testid="explore-v2-cta-continue"/);
  assert.match(html, />Book</);
  assert.match(html, /data-testid="explore-v2-cta-view-details"/);
  assert.match(html, /href="\/properties\/listing-1\?source=explore_v0"/);
  assert.match(html, /data-testid="explore-v2-cta-save-surface"/);
  assert.match(html, /data-testid="explore-v2-cta-share-action"/);
  assert.match(html, />Video</);
});

void test("explore-v2 conversion quick action label copy maps book and viewing intents", () => {
  assert.equal(resolveExploreV2ConversionQuickActionLabel("Book"), "Book now");
  assert.equal(resolveExploreV2ConversionQuickActionLabel("Request viewing"), "Request viewing");
});
