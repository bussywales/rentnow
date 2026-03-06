import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createExploreV2OverlayFocusController,
  continueExploreV2Cta,
  EXPLORE_V2_GLASS_TOAST_BOTTOM_OFFSET_PX,
  EXPLORE_V2_QUIET_OVERLAY_FOCUS_MS,
  EXPLORE_V2_QUIET_OVERLAY_OPACITY_CLASS,
  ExploreV2Card,
  resolveExploreV2GlassToastBottom,
  resolveExploreV2GlassToastClassName,
  resolveExploreV2HasVideo,
  resolveExploreV2ActionContext,
  resolveExploreV2CarouselItems,
  resolveExploreV2SaveFeedbackMessage,
  resolveExploreV2ShareFeedback,
  resolveExploreV2HeroUiState,
  resolveExploreV2OverlayOpacityClass,
  shouldShowExploreV2TitleTooltip,
  trackExploreV2SaveToggle,
  triggerExploreV2ShareAction,
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
  assert.match(html, /data-testid=\"explore-v2-action-rail\"/);
  assert.match(html, /data-testid=\"explore-v2-share-action\"/);
  assert.match(html, /data-testid=\"explore-v2-cta-action\"/);
  assert.match(
    html,
    /class=\"[^\"]*right-4[^\"]*top-1\/2[^\"]*-translate-y-1\/2[^\"]*gap-3[^\"]*\" data-testid=\"explore-v2-action-rail\"/
  );
  assert.match(html, /class=\"[^\"]*absolute bottom-16 right-4[^\"]*\" data-testid=\"explore-v2-cta-container\"/);
  assert.match(
    html,
    /class=\"[^\"]*h-10[^\"]*min-w-\[112px\][^\"]*max-w-\[156px\][^\"]*\"[^>]*data-testid=\"explore-v2-cta-action\"/
  );
  assert.match(html, /class=\"[^\"]*h-10 w-10[^\"]*\"[^>]*data-testid=\"explore-v2-share-action\"/);
  assert.match(html, /data-testid=\"explore-v2-save-surface\"/);
  assert.match(html, /data-testid=\"explore-v2-share-surface\"/);
  assert.match(html, /class=\"[^\"]*right-4[^\"]*top-4[^\"]*\"[^>]*data-testid=\"explore-v2-hero-carousel-count-badge\"/);
  assert.match(html, /class=\"[^\"]*bottom-3[^\"]*\" data-testid=\"explore-v2-hero-carousel-dots\"/);
  assert.match(
    html,
    /class=\"[^\"]*transition-opacity[^\"]*duration-200[^\"]*opacity-\[0\.85\][^\"]*\" data-testid=\"explore-v2-action-rail\"/
  );
  assert.match(
    html,
    /class=\"[^\"]*transition-opacity[^\"]*duration-200[^\"]*opacity-\[0\.85\][^\"]*\" data-testid=\"explore-v2-cta-container\"/
  );
  assert.match(html, /data-testid=\"explore-v2-title\"/);
  assert.match(html, /aria-label=\"Victoria Island Apartment\"/);
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

void test("explore-v2 card applies logged-out save guard to prevent hard redirect", () => {
  const listing = createExploreV2Listing();
  const html = renderToStaticMarkup(
    React.createElement(ExploreV2Card, {
      listing,
      marketCurrency: "NGN",
      imageRecords: [],
      viewerIsAuthenticated: false,
    })
  );

  assert.match(html, /data-testid=\"explore-v2-save-surface\"/);
  assert.match(html, /pointer-events-none/);
});

void test("explore-v2 video badge only renders when listing has video signal", () => {
  const withoutVideo = createExploreV2Listing({
    has_video: false,
    featured_media: "image",
    property_videos: [],
  });
  const withVideo = createExploreV2Listing({
    has_video: true,
    featured_media: "image",
    property_videos: [{ id: "video-1", video_url: "https://example.test/video.mp4" }],
  });

  const withoutVideoHtml = renderToStaticMarkup(
    React.createElement(ExploreV2Card, {
      listing: withoutVideo,
      marketCurrency: "NGN",
      imageRecords: [],
    })
  );
  const withVideoHtml = renderToStaticMarkup(
    React.createElement(ExploreV2Card, {
      listing: withVideo,
      marketCurrency: "NGN",
      imageRecords: [],
    })
  );

  assert.doesNotMatch(withoutVideoHtml, /data-testid=\"explore-v2-video-badge\"/);
  assert.match(withVideoHtml, /data-testid=\"explore-v2-video-badge\"/);
  assert.match(withVideoHtml, /Video tour/);
  assert.match(withVideoHtml, /media=video/);
});

void test("explore-v2 has-video resolver prefers property_videos with featured-media fallback", () => {
  assert.equal(
    resolveExploreV2HasVideo(
      createExploreV2Listing({
        has_video: true,
        featured_media: "image",
        property_videos: [],
      })
    ),
    true
  );
  assert.equal(
    resolveExploreV2HasVideo(
      createExploreV2Listing({
        has_video: false,
        featured_media: "video",
        property_videos: [{ id: "video-1", video_url: "https://example.test/video.mp4" }],
      })
    ),
    false
  );
  assert.equal(
    resolveExploreV2HasVideo(
      createExploreV2Listing({
        featured_media: "image",
        property_videos: [{ id: "video-1", video_url: "https://example.test/video.mp4" }],
      })
    ),
    true
  );
  assert.equal(
    resolveExploreV2HasVideo(
      createExploreV2Listing({
        featured_media: "video",
        property_videos: [],
      })
    ),
    true
  );
  assert.equal(
    resolveExploreV2HasVideo(
      createExploreV2Listing({
        featured_media: "image",
        property_videos: [],
      })
    ),
    false
  );
});

void test("explore-v2 save toggle analytics helper emits saved/unsaved results", () => {
  const listing = createExploreV2Listing({ id: "listing-save", country_code: "NG" });
  const context = resolveExploreV2ActionContext({
    listing,
    index: 2,
    feedSize: 12,
  });
  const emitted: Array<{ name?: string; result?: string | null }> = [];

  trackExploreV2SaveToggle({
    context,
    saved: true,
    trackFn: (event) => {
      emitted.push({ name: event.name, result: event.result ?? null });
      return [];
    },
  });
  trackExploreV2SaveToggle({
    context,
    saved: false,
    trackFn: (event) => {
      emitted.push({ name: event.name, result: event.result ?? null });
      return [];
    },
  });

  assert.deepEqual(emitted, [
    { name: "explore_v2_save_toggle", result: "saved" },
    { name: "explore_v2_save_toggle", result: "unsaved" },
  ]);
});

void test("explore-v2 save feedback copy resolves to saved/removed labels", () => {
  assert.equal(resolveExploreV2SaveFeedbackMessage(true), "Saved");
  assert.equal(resolveExploreV2SaveFeedbackMessage(false), "Removed");
});

void test("explore-v2 title tooltip helper only enables when title is truncated", () => {
  assert.equal(
    shouldShowExploreV2TitleTooltip({
      title: "A very long listing title",
      isTruncated: true,
    }),
    true
  );
  assert.equal(
    shouldShowExploreV2TitleTooltip({
      title: "Short title",
      isTruncated: false,
    }),
    false
  );
});

void test("explore-v2 share helper uses share util and emits analytics", async () => {
  const listing = createExploreV2Listing({ id: "listing-share", country_code: "NG" });
  const context = resolveExploreV2ActionContext({ listing, index: 1, feedSize: 10 });
  const tracked: string[] = [];
  const sharePayloads: string[] = [];

  const result = await triggerExploreV2ShareAction(
    {
      detailsHref: `/properties/${listing.id}?source=explore_v0`,
      title: listing.title,
      locationLine: "Lagos, NG",
      context,
    },
    {
      origin: "https://propatyhub.com",
      shareFn: async (payload) => {
        sharePayloads.push(payload.url);
        return "shared";
      },
      trackFn: (event) => {
        tracked.push(event.name);
        return [];
      },
    }
  );

  assert.equal(result, "shared");
  assert.equal(sharePayloads[0], `https://propatyhub.com/properties/${listing.id}?source=explore_v0`);
  assert.deepEqual(tracked, ["explore_v2_share"]);
});

void test("explore-v2 share feedback maps copied path to link copied toast", () => {
  assert.deepEqual(resolveExploreV2ShareFeedback("copied"), {
    message: "Link copied",
    tone: "success",
    showRetry: false,
  });
});

void test("explore-v2 glass toast contract uses glass classes and dock-safe offset", () => {
  const successClassName = resolveExploreV2GlassToastClassName("success");
  assert.match(successClassName, /backdrop-blur-md/);
  assert.match(successClassName, /rounded-\[999px\]/);
  assert.equal(
    resolveExploreV2GlassToastBottom(),
    `calc(${EXPLORE_V2_GLASS_TOAST_BOTTOM_OFFSET_PX}px + env(safe-area-inset-bottom))`
  );
});

void test("explore-v2 cta continue helper tracks and navigates", () => {
  const listing = createExploreV2Listing({ id: "listing-cta", country_code: "NG" });
  const context = resolveExploreV2ActionContext({ listing, index: 0, feedSize: 4 });
  let pushedHref: string | null = null;
  const tracked: string[] = [];

  continueExploreV2Cta(
    {
      href: `/properties/${listing.id}?source=explore_v0#cta`,
      context,
    },
    {
      pushFn: (href) => {
        pushedHref = href;
      },
      trackFn: (event) => {
        tracked.push(event.name);
        return [];
      },
    }
  );

  assert.equal(pushedHref, `/properties/${listing.id}?source=explore_v0#cta`);
  assert.deepEqual(tracked, ["explore_v2_cta_continue"]);
});

void test("explore-v2 quiet overlay controller elevates opacity on interaction and resets after timeout", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const focusedStates: boolean[] = [];
  const controller = createExploreV2OverlayFocusController({
    focusDurationMs: EXPLORE_V2_QUIET_OVERLAY_FOCUS_MS,
    onChange: (next) => {
      focusedStates.push(next);
    },
  });

  assert.equal(resolveExploreV2OverlayOpacityClass(controller.isFocused()), EXPLORE_V2_QUIET_OVERLAY_OPACITY_CLASS);

  controller.trigger();
  assert.equal(controller.isFocused(), true);
  assert.equal(resolveExploreV2OverlayOpacityClass(controller.isFocused()), "opacity-100");

  t.mock.timers.tick(EXPLORE_V2_QUIET_OVERLAY_FOCUS_MS - 1);
  assert.equal(controller.isFocused(), true);

  t.mock.timers.tick(1);
  assert.equal(controller.isFocused(), false);
  assert.equal(resolveExploreV2OverlayOpacityClass(controller.isFocused()), EXPLORE_V2_QUIET_OVERLAY_OPACITY_CLASS);

  controller.dispose();
  assert.deepEqual(focusedStates, [true, false]);
});
