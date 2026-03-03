import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ExploreV2Card,
  resolveExploreV2CarouselItems,
  resolveExploreV2HeroUiState,
} from "@/components/explore-v2/ExploreV2Card";
import type { Property, PropertyImage } from "@/lib/types";

function createExploreV2Listing(overrides: Partial<Property> = {}): Property {
  return {
    id: "listing-1",
    owner_id: "owner-1",
    title: "Victoria Island apartment",
    city: "Lagos",
    rental_type: "long_term",
    listing_intent: "rent_lease",
    price: 1800000,
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    furnished: true,
    ...overrides,
  };
}

void test("explore-v2 carousel items prefer position order and fallback to created_at", () => {
  const listing = createExploreV2Listing();
  const imageRecords: PropertyImage[] = [
    {
      id: "img-2",
      image_url: "https://example.supabase.co/storage/v1/object/public/images/2.jpg",
      position: 2,
      created_at: "2026-03-01T10:00:00.000Z",
    },
    {
      id: "img-0",
      image_url: "https://example.supabase.co/storage/v1/object/public/images/0.jpg",
      position: 0,
      created_at: "2026-03-01T08:00:00.000Z",
    },
    {
      id: "img-1",
      image_url: "https://example.supabase.co/storage/v1/object/public/images/1.jpg",
      created_at: "2026-03-01T09:00:00.000Z",
    },
  ];

  const resolved = resolveExploreV2CarouselItems({
    listing,
    imageRecords,
  });

  assert.deepEqual(
    resolved.items.map((item) => item.src),
    [
      "https://example.supabase.co/storage/v1/object/public/images/0.jpg",
      "https://example.supabase.co/storage/v1/object/public/images/2.jpg",
      "https://example.supabase.co/storage/v1/object/public/images/1.jpg",
    ]
  );
});

void test("explore-v2 hero UI state enables dots/count only for multi-image listings", () => {
  assert.deepEqual(resolveExploreV2HeroUiState(1), {
    showSwipeAffordance: false,
    showDots: false,
    showCountBadge: false,
  });
  assert.deepEqual(resolveExploreV2HeroUiState(3), {
    showSwipeAffordance: true,
    showDots: true,
    showCountBadge: true,
  });
});

void test("explore-v2 card renders carousel with count and dots for multi-image listings", () => {
  const listing = createExploreV2Listing();
  const imageRecords: PropertyImage[] = [
    {
      id: "img-0",
      image_url: "https://example.supabase.co/storage/v1/object/public/images/0.jpg",
    },
    {
      id: "img-1",
      image_url: "https://example.supabase.co/storage/v1/object/public/images/1.jpg",
    },
  ];
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2Card, {
      listing,
      marketCurrency: "NGN",
      imageRecords,
    })
  );

  assert.match(html, /data-testid=\"explore-v2-hero-carousel\"/);
  assert.match(html, /data-testid=\"explore-v2-hero-carousel-count-badge\"/);
  assert.match(html, /data-testid=\"explore-v2-hero-carousel-dots\"/);
});

void test("explore-v2 card hides count and dots for single-image listing", () => {
  const listing = createExploreV2Listing();
  const imageRecords: PropertyImage[] = [
    {
      id: "img-only",
      image_url: "https://example.supabase.co/storage/v1/object/public/images/only.jpg",
    },
  ];
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2Card, {
      listing,
      marketCurrency: "NGN",
      imageRecords,
    })
  );

  assert.match(html, /data-testid=\"explore-v2-hero-carousel\"/);
  assert.doesNotMatch(html, /data-testid=\"explore-v2-hero-carousel-count-badge\"/);
  assert.doesNotMatch(html, /data-testid=\"explore-v2-hero-carousel-dots\"/);
});
