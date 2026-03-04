import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  UNIFIED_CAROUSEL_LOADING_CUE_MIN_VISIBLE_MS,
  UNIFIED_CAROUSEL_LOADING_CUE_SHOW_AFTER_MS,
  UNIFIED_CAROUSEL_MIN_PLACEHOLDER_VISIBLE_MS,
  UNIFIED_CAROUSEL_PREMIUM_NEUTRAL_SLIDE_BACKGROUND_CLASS,
  resolveUnifiedImageCarouselLoadCandidates,
  resolveUnifiedImageCarouselMaxConcurrentImageLoads,
  resolveUnifiedImagePlaceholderHoldMs,
  resolveUnifiedImagePlaceholderPresentation,
  waitForUnifiedImageRevealGate,
  shouldRenderUnifiedImageCarouselCountBadge,
  shouldRenderUnifiedImageCarouselControls,
  shouldRenderUnifiedImageCarouselDots,
} from "@/components/ui/UnifiedImageCarousel";
import {
  accumulateWheelDelta,
  resolveWheelDelta,
  resolveWheelDirection,
  shouldSuppressCarouselClickAfterDrag,
  shouldThrottleWheelNavigation,
  shouldTreatWheelAsHorizontal,
} from "@/lib/ui/carousel-interactions";

const unifiedCarouselPath = path.join(process.cwd(), "components", "ui", "UnifiedImageCarousel.tsx");

void test("unified image carousel controls and badge visibility only activate for multi-image sets", () => {
  assert.equal(shouldRenderUnifiedImageCarouselControls(0), false);
  assert.equal(shouldRenderUnifiedImageCarouselControls(1), false);
  assert.equal(shouldRenderUnifiedImageCarouselControls(2), true);
  assert.equal(shouldRenderUnifiedImageCarouselCountBadge(1), false);
  assert.equal(shouldRenderUnifiedImageCarouselCountBadge(2), true);
});

void test("unified image carousel dots follow a consistent threshold", () => {
  assert.equal(shouldRenderUnifiedImageCarouselDots(1), false);
  assert.equal(shouldRenderUnifiedImageCarouselDots(3), false);
  assert.equal(shouldRenderUnifiedImageCarouselDots(4), true);
});

void test("unified image carousel suppresses click navigation only after drag threshold", () => {
  assert.equal(shouldSuppressCarouselClickAfterDrag(4), false);
  assert.equal(shouldSuppressCarouselClickAfterDrag(8), false);
  assert.equal(shouldSuppressCarouselClickAfterDrag(9), true);
});

void test("unified image carousel resolves horizontal wheel deltas for trackpad and shift-scroll", () => {
  assert.equal(resolveWheelDelta({ deltaX: 36, deltaY: 4, shiftKey: false }), 36);
  assert.equal(resolveWheelDelta({ deltaX: 0, deltaY: 48, shiftKey: true }), 48);
});

void test("unified image carousel handles only meaningful horizontal wheel gestures", () => {
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 24, deltaY: 2, shiftKey: false }), true);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 2, deltaY: 24, shiftKey: false }), false);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 0, deltaY: 40, shiftKey: true }), true);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 1, deltaY: 18, shiftKey: false }), false);
});

void test("unified image carousel wheel direction mapping supports both directions", () => {
  assert.equal(resolveWheelDirection({ deltaX: 18, deltaY: 1, shiftKey: false }), "next");
  assert.equal(resolveWheelDirection({ deltaX: -18, deltaY: 1, shiftKey: false }), "prev");
});

void test("unified image carousel wheel direction mapping supports shift+wheel fallback both directions", () => {
  assert.equal(resolveWheelDirection({ deltaX: 0, deltaY: 24, shiftKey: true }), "next");
  assert.equal(resolveWheelDirection({ deltaX: 0, deltaY: -24, shiftKey: true }), "prev");
});

void test("unified image carousel wheel accumulation resets when direction changes", () => {
  assert.equal(
    accumulateWheelDelta({
      accumulatedDelta: 16,
      nextDelta: -5,
    }),
    -5
  );
  assert.equal(
    accumulateWheelDelta({
      accumulatedDelta: -20,
      nextDelta: 7,
    }),
    7
  );
});

void test("unified image carousel wheel throttle blocks repeated direction but allows instant direction reversal", () => {
  assert.equal(
    shouldThrottleWheelNavigation({
      nowMs: 1_000,
      lastTriggeredAtMs: 920,
      nextDirection: "next",
      lastDirection: "next",
      throttleMs: 160,
    }),
    true
  );

  assert.equal(
    shouldThrottleWheelNavigation({
      nowMs: 1_000,
      lastTriggeredAtMs: 920,
      nextDirection: "prev",
      lastDirection: "next",
      throttleMs: 160,
    }),
    false
  );
});

void test("unified image carousel resolves sane concurrent load caps", () => {
  assert.equal(resolveUnifiedImageCarouselMaxConcurrentImageLoads(undefined), 3);
  assert.equal(resolveUnifiedImageCarouselMaxConcurrentImageLoads(0), 1);
  assert.equal(resolveUnifiedImageCarouselMaxConcurrentImageLoads(2), 2);
});

void test("unified image carousel mounts only capped pending slides while preserving loaded slides", () => {
  const mounted = resolveUnifiedImageCarouselLoadCandidates({
    totalImages: 6,
    selectedIndex: 2,
    windowRadius: 2,
    loadedIndexes: new Set([2]),
    maxConcurrentImageLoads: 2,
  });
  assert.deepEqual(Array.from(mounted.values()).sort((a, b) => a - b), [1, 2, 3]);
});

void test("unified image carousel placeholder presentation prioritizes item metadata", () => {
  const presentation = resolveUnifiedImagePlaceholderPresentation({
    item: {
      id: "img-1",
      src: "https://example.com/image.jpg",
      alt: "Image",
      placeholderColor: "#123456",
      placeholderBlurDataURL: "data:image/svg+xml,custom",
      placeholderSource: "dominant_color",
    },
    fallbackBlurDataURL: "data:image/gif;base64,base",
  });
  assert.equal(presentation.dominantColor, "#123456");
  assert.equal(presentation.blurDataURL, "data:image/svg+xml,custom");
  assert.equal(presentation.source, "dominant_color");
});

void test("unified image carousel placeholder presentation falls back when metadata is missing", () => {
  const presentation = resolveUnifiedImagePlaceholderPresentation({
    item: {
      id: "img-2",
      src: "https://example.com/no-meta.jpg",
      alt: "Image",
    },
    fallbackBlurDataURL: "data:image/gif;base64,base",
  });
  assert.ok(presentation.dominantColor.startsWith("#"));
  assert.ok(presentation.blurDataURL.startsWith("data:image/svg+xml,"));
});

void test("unified image carousel uses a stable premium neutral slide background token", () => {
  assert.equal(
    UNIFIED_CAROUSEL_PREMIUM_NEUTRAL_SLIDE_BACKGROUND_CLASS,
    "bg-slate-950/10 dark:bg-slate-100/10"
  );
});

void test("unified image carousel consumes the shared interaction policy module", () => {
  const contents = fs.readFileSync(unifiedCarouselPath, "utf8");
  assert.ok(contents.includes('from "@/lib/ui/carousel-interactions"'));
  assert.ok(contents.includes('from "@/lib/images/loading-profile"'));
  assert.ok(contents.includes('from "@/lib/images/optimizer-bypass"'));
  assert.ok(contents.includes('from "@/lib/ui/useDebouncedVisibility"'));
  assert.ok(contents.includes("shouldTreatWheelAsHorizontal(event)"));
  assert.ok(contents.includes("accumulateWheelDelta"));
  assert.ok(contents.includes("resolveWheelDirectionFromAccumulatedDelta"));
  assert.ok(contents.includes("resolveImageLoadingProfile"));
  assert.ok(contents.includes("unoptimized={bypassOptimizer}"));
  assert.ok(contents.includes("loader={bypassOptimizer ? directImageLoader : undefined}"));
  assert.ok(contents.includes("data-placeholder-source={placeholder.source}"));
  assert.ok(contents.includes('data-placeholder-persistent="true"'));
  assert.ok(contents.includes("UNIFIED_CAROUSEL_PREMIUM_NEUTRAL_SLIDE_BACKGROUND_CLASS"));
  assert.ok(contents.includes('style={{ backgroundColor: placeholder.dominantColor }}'));
  assert.ok(contents.includes('"h-full overflow-hidden overscroll-x-contain"'));
  assert.ok(contents.includes('style={{ touchAction: "pan-y pinch-zoom" }}'));
  assert.ok(contents.includes('data-testid={`${rootTestId}-viewport`}'));
  assert.ok(contents.includes('data-testid={`${rootTestId}-track`}'));
  assert.ok(!contents.includes("overflow-x-scroll overflow-y-hidden"));
  assert.ok(!contents.includes("touch-pan-x"));
  assert.ok(contents.includes("waitForUnifiedImageRevealGate"));
  assert.ok(contents.includes("UNIFIED_CAROUSEL_MIN_PLACEHOLDER_VISIBLE_MS"));
  assert.ok(contents.includes("const shouldShowDebouncedLoadingCue = useDebouncedVisibility"));
  assert.ok(contents.includes('showAfterMs: UNIFIED_CAROUSEL_LOADING_CUE_SHOW_AFTER_MS'));
  assert.ok(contents.includes('minVisibleMs: UNIFIED_CAROUSEL_LOADING_CUE_MIN_VISIBLE_MS'));
  assert.ok(contents.includes('shouldShowDebouncedLoadingCue ? "opacity-100" : "opacity-0"'));
  assert.equal(UNIFIED_CAROUSEL_LOADING_CUE_SHOW_AFTER_MS, 300);
  assert.equal(UNIFIED_CAROUSEL_LOADING_CUE_MIN_VISIBLE_MS, 600);
  assert.equal(UNIFIED_CAROUSEL_MIN_PLACEHOLDER_VISIBLE_MS, 160);
});

void test("unified image carousel placeholder hold resolves remaining min-visible duration", () => {
  const holdMs = resolveUnifiedImagePlaceholderHoldMs({
    startedAtMs: 1_000,
    minVisibleMs: 160,
    nowMs: 1_070,
  });
  assert.equal(holdMs, 90);
});

void test("unified image carousel reveal gate waits for decode before releasing placeholder", async () => {
  let released = false;
  let resolveDecode: (() => void) | null = null;
  const decodePromise = new Promise<void>((resolve) => {
    resolveDecode = resolve;
  });
  const sleepCalls: number[] = [];
  let completed = false;

  const revealPromise = waitForUnifiedImageRevealGate({
    startedAtMs: 1_000,
    minVisibleMs: 160,
    decode: async () => decodePromise,
    now: () => 1_100,
    sleep: async (ms) => {
      sleepCalls.push(ms);
      released = true;
    },
  }).then(() => {
    completed = true;
  });

  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(released, false);

  resolveDecode?.();
  await revealPromise;
  assert.equal(completed, true);
  assert.equal(released, true);
  assert.deepEqual(sleepCalls, [60]);
});
