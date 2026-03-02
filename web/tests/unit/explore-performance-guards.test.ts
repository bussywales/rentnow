import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  preloadExploreImageUrlsWithConcurrency,
  resolveExplorePreloadImageUrls,
  resolveExplorePreloadSlideIndexes,
  shouldPreloadExploreSlideImages,
} from "@/components/explore/ExplorePager";

void test("explore preload indexes include active slide and adjacent slides only", () => {
  assert.deepEqual(resolveExplorePreloadSlideIndexes(0, 4), [0, 1]);
  assert.deepEqual(resolveExplorePreloadSlideIndexes(2, 5), [2, 3, 1]);
  assert.deepEqual(resolveExplorePreloadSlideIndexes(4, 5), [4, 3]);
});

void test("explore preload urls include only first-image candidates not already cached", () => {
  const urls = resolveExplorePreloadImageUrls({
    activeIndex: 1,
    totalSlides: 4,
    heroImageUrls: ["a.jpg", "b.jpg", "c.jpg", "d.jpg"],
    alreadyPreloaded: new Set(["c.jpg"]),
  });
  assert.deepEqual(urls, ["b.jpg", "a.jpg"]);
});

void test("explore preload is disabled for saveData and active gesture locks", () => {
  assert.equal(shouldPreloadExploreSlideImages(true, false), false);
  assert.equal(shouldPreloadExploreSlideImages(false, true), false);
  assert.equal(shouldPreloadExploreSlideImages(false, false), true);
});

void test("explore preload concurrency cap limits in-flight image mounts", () => {
  const completions: Array<() => void> = [];
  let mountedInFlight = 0;
  let peakMountedInFlight = 0;
  const alreadyPreloaded = new Set<string>();

  preloadExploreImageUrlsWithConcurrency({
    imageUrls: ["a.jpg", "b.jpg", "c.jpg", "d.jpg"],
    alreadyPreloaded,
    maxConcurrent: 2,
    createImage: () => {
      const image = {
        decoding: "auto",
        onload: null as HTMLImageElement["onload"],
        onerror: null as HTMLImageElement["onerror"],
      } as {
        decoding: "sync" | "async" | "auto";
        onload: HTMLImageElement["onload"];
        onerror: HTMLImageElement["onerror"];
        src: string;
      };
      Object.defineProperty(image, "src", {
        get: () => "",
        set: () => {
          mountedInFlight += 1;
          peakMountedInFlight = Math.max(peakMountedInFlight, mountedInFlight);
          completions.push(() => {
            mountedInFlight = Math.max(0, mountedInFlight - 1);
            image.onload?.(new Event("load"));
          });
        },
      });
      return image;
    },
  });

  assert.equal(peakMountedInFlight, 2);
  while (completions.length) {
    const complete = completions.shift();
    complete?.();
  }
  assert.equal(mountedInFlight, 0);
  assert.equal(alreadyPreloaded.size, 4);
});

void test("explore pager source keeps idle-safe preload scheduler and cancellation hooks", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePager.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveExplorePreloadSlideIndexes/);
  assert.match(source, /resolveExplorePreloadImageUrls/);
  assert.match(source, /preloadExploreImageUrlsWithConcurrency/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /cancelPreloadRef/);
  assert.match(source, /isGestureLockedRef/);
  assert.match(source, /<ExploreProgressPill/);
});

void test("explore details sheet source still lazy-mounts heavy sections behind open state", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreDetailsSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /const shouldRenderDetailsBody = open/);
  assert.match(source, /factsForProperty\(property\) : \[\]/);
  assert.match(source, /\(property\.amenities \?\? \[\]\)\.slice\(0, 5\) : \[\]/);
  assert.match(source, /similarHomes\.slice\(0, 3\) : \[\]/);
  assert.match(source, /shouldRenderDetailsBody \? \(/);
});
