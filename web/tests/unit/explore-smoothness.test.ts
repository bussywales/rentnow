import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  clearDecodedImageCacheForTests,
  predecodeImageUrl,
  resolveImageDecodeConcurrency,
} from "@/lib/images/decode";

type GlobalWithWindow = typeof globalThis & {
  window?: unknown;
};

function withMockWindow<T>(run: () => Promise<T> | T): Promise<T> | T {
  const globalWithWindow = globalThis as GlobalWithWindow;
  const previousWindow = globalWithWindow.window;
  globalWithWindow.window = {};
  const finalize = () => {
    if (previousWindow === undefined) {
      delete globalWithWindow.window;
      return;
    }
    globalWithWindow.window = previousWindow;
  };

  try {
    const result = run();
    if (result && typeof (result as Promise<T>).then === "function") {
      return (result as Promise<T>).finally(finalize);
    }
    finalize();
    return result;
  } catch (error) {
    finalize();
    throw error;
  }
}

void test("explore smoothness decode helper resolves sane concurrency defaults", () => {
  assert.equal(resolveImageDecodeConcurrency(undefined), 2);
  assert.equal(resolveImageDecodeConcurrency(0), 1);
  assert.equal(resolveImageDecodeConcurrency(3), 3);
});

void test("explore smoothness decode helper caches decoded urls to avoid repeated work", async () => {
  clearDecodedImageCacheForTests();
  let createImageCalls = 0;
  await withMockWindow(async () => {
    const decodeCalls: Array<string> = [];
    const createImage = () => {
      createImageCalls += 1;
      return {
        decoding: "auto",
        src: "",
        onload: null,
        onerror: null,
        decode: () => {
          decodeCalls.push("decode");
          return Promise.resolve();
        },
      } as unknown as HTMLImageElement;
    };

    const first = await predecodeImageUrl({
      imageUrl: "https://example.com/a.jpg",
      createImage,
      maxConcurrent: 2,
    });
    const second = await predecodeImageUrl({
      imageUrl: "https://example.com/a.jpg",
      createImage,
      maxConcurrent: 2,
    });

    assert.equal(first, true);
    assert.equal(second, true);
    assert.equal(createImageCalls, 1);
    assert.equal(decodeCalls.length, 1);
  });
});

void test("explore smoothness decode helper respects in-flight concurrency caps", async () => {
  clearDecodedImageCacheForTests();
  await withMockWindow(async () => {
    let releaseDecode: (() => void) | null = null;
    const createImage = () =>
      ({
        decoding: "auto",
        src: "",
        onload: null,
        onerror: null,
        decode: () =>
          new Promise<void>((resolve) => {
            releaseDecode = resolve;
          }),
      }) as unknown as HTMLImageElement;

    const firstDecode = predecodeImageUrl({
      imageUrl: "https://example.com/a.jpg",
      createImage,
      maxConcurrent: 1,
    });
    const secondDecode = await predecodeImageUrl({
      imageUrl: "https://example.com/b.jpg",
      createImage,
      maxConcurrent: 1,
    });

    assert.equal(secondDecode, false);
    releaseDecode?.();
    const firstResult = await firstDecode;
    assert.equal(firstResult, true);
  });
});

void test("explore smoothness source keeps persistent placeholders and debounced loading cue", () => {
  const sourcePath = path.join(process.cwd(), "components", "ui", "UnifiedImageCarousel.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-placeholder-persistent="true"/);
  assert.match(source, /const shouldShowDebouncedLoadingCue = useDebouncedVisibility/);
  assert.match(source, /showAfterMs: UNIFIED_CAROUSEL_LOADING_CUE_SHOW_AFTER_MS/);
  assert.match(source, /minVisibleMs: UNIFIED_CAROUSEL_LOADING_CUE_MIN_VISIBLE_MS/);
  assert.doesNotMatch(source, /showLoadingCue && !activeImageLoaded/);
  assert.doesNotMatch(source, /animate-pulse opacity-100/);
});
