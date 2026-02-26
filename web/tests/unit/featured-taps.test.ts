import test from "node:test";
import assert from "node:assert/strict";
import {
  clearRecentFeaturedTaps,
  getRecentFeaturedTaps,
  mergeRecentSearchesWithFeaturedTaps,
  pushRecentFeaturedTap,
} from "@/lib/search/featured-taps";

type StorageMap = Record<string, string>;

function createStorageMock(seed: StorageMap = {}) {
  const store: StorageMap = { ...seed };
  return {
    getItem(key: string) {
      return Object.hasOwn(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
  };
}

function withWindowStorage(seed: StorageMap | undefined, callback: () => void) {
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: createStorageMock(seed),
    dispatchEvent() {
      return true;
    },
  };
  try {
    callback();
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
}

test("pushRecentFeaturedTap dedupes by id+market and keeps freshest first", () => {
  withWindowStorage(undefined, () => {
    pushRecentFeaturedTap({
      id: "ng-shortlet-weekend",
      kind: "shortlet",
      href: "/shortlets?where=Lekki",
      label: "Weekend in Lekki",
      marketCountry: "NG",
    });
    pushRecentFeaturedTap({
      id: "ng-rent-family",
      kind: "property",
      href: "/properties?intent=rent&city=Abuja",
      label: "Family homes in Abuja",
      marketCountry: "NG",
    });
    pushRecentFeaturedTap({
      id: "ng-shortlet-weekend",
      kind: "shortlet",
      href: "/shortlets?where=Lekki",
      label: "Weekend in Lekki",
      marketCountry: "NG",
    });

    const ng = getRecentFeaturedTaps({ marketCountry: "NG", limit: 5 });
    assert.equal(ng.length, 2);
    assert.equal(ng[0]?.id, "ng-shortlet-weekend");
    assert.equal(ng[1]?.id, "ng-rent-family");
  });
});

test("clearRecentFeaturedTaps can clear one market without touching another", () => {
  withWindowStorage(undefined, () => {
    pushRecentFeaturedTap({
      id: "ng-shortlet-weekend",
      kind: "shortlet",
      href: "/shortlets?where=Lekki",
      label: "Weekend in Lekki",
      marketCountry: "NG",
    });
    pushRecentFeaturedTap({
      id: "ca-rent-downtown",
      kind: "property",
      href: "/properties?intent=rent&city=Toronto",
      label: "Downtown apartments",
      marketCountry: "CA",
    });

    clearRecentFeaturedTaps({ marketCountry: "NG" });
    assert.equal(getRecentFeaturedTaps({ marketCountry: "NG" }).length, 0);
    assert.equal(getRecentFeaturedTaps({ marketCountry: "CA" }).length, 1);
  });
});

test("mergeRecentSearchesWithFeaturedTaps merges deterministically and avoids duplicates", () => {
  const merged = mergeRecentSearchesWithFeaturedTaps({
    searchTerms: ["Lekki", "Abuja"],
    featuredTaps: [
      {
        id: "ng-shortlet-weekend",
        marketCountry: "NG",
        kind: "shortlet",
        href: "/shortlets?where=Lekki",
        label: "Weekend in Lekki",
        query: "Lekki",
        source: "featured",
        tappedAt: "2026-02-26T09:00:00.000Z",
      },
      {
        id: "ng-rent-family",
        marketCountry: "NG",
        kind: "property",
        href: "/properties?intent=rent&city=Abuja",
        label: "Family homes in Abuja",
        query: "Abuja",
        source: "featured",
        tappedAt: "2026-02-26T08:00:00.000Z",
      },
      {
        id: "ng-buy-central",
        marketCountry: "NG",
        kind: "property",
        href: "/properties?intent=buy&city=Yaba",
        label: "Buy in Yaba",
        query: "Yaba",
        source: "featured",
        tappedAt: "2026-02-26T07:00:00.000Z",
      },
    ],
    limit: 5,
  });

  assert.deepEqual(
    merged.map((item) => `${item.source}:${item.query || item.label}`),
    ["search:Lekki", "search:Abuja", "featured:Yaba"]
  );
});

test("featured taps helpers are SSR-safe when window is unavailable", () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  delete (globalThis as { window?: unknown }).window;
  try {
    assert.deepEqual(getRecentFeaturedTaps(), []);
    assert.deepEqual(
      pushRecentFeaturedTap({
        id: "x",
        kind: "shortlet",
        href: "/shortlets?where=Lekki",
        label: "Weekend in Lekki",
      }),
      []
    );
    assert.deepEqual(clearRecentFeaturedTaps(), []);
  } finally {
    if (previousWindow !== undefined) {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
});
