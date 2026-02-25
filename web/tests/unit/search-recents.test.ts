import test from "node:test";
import assert from "node:assert/strict";
import { clearRecentSearches, getRecentSearches, pushRecentSearch } from "@/lib/search/recents";

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
    clear() {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
}

function withWindowStorage(seed: StorageMap | undefined, callback: () => void) {
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: createStorageMock(seed),
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

test("pushRecentSearch dedupes case-insensitively and keeps most recent first", () => {
  withWindowStorage(undefined, () => {
    pushRecentSearch("mobile_quicksearch_v1", "Lagos");
    pushRecentSearch("mobile_quicksearch_v1", "Abuja");
    const next = pushRecentSearch("mobile_quicksearch_v1", "lagos");

    assert.deepEqual(next, ["lagos", "Abuja"]);
    assert.deepEqual(getRecentSearches("mobile_quicksearch_v1"), ["lagos", "Abuja"]);
  });
});

test("pushRecentSearch trims values and enforces limit", () => {
  withWindowStorage(undefined, () => {
    pushRecentSearch("mobile_quicksearch_v1", "  Lagos  ", 2);
    pushRecentSearch("mobile_quicksearch_v1", "Abuja", 2);
    const next = pushRecentSearch("mobile_quicksearch_v1", "Ibadan", 2);

    assert.deepEqual(next, ["Ibadan", "Abuja"]);
    assert.deepEqual(getRecentSearches("mobile_quicksearch_v1", 2), ["Ibadan", "Abuja"]);
  });
});

test("clearRecentSearches removes stored recents", () => {
  withWindowStorage({ mobile_quicksearch_v1: JSON.stringify(["Lagos", "Abuja"]) }, () => {
    assert.deepEqual(getRecentSearches("mobile_quicksearch_v1"), ["Lagos", "Abuja"]);
    clearRecentSearches("mobile_quicksearch_v1");
    assert.deepEqual(getRecentSearches("mobile_quicksearch_v1"), []);
  });
});

test("recents helpers are SSR-safe when window is missing", () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  delete (globalThis as { window?: unknown }).window;
  try {
    assert.deepEqual(getRecentSearches("mobile_quicksearch_v1"), []);
    assert.deepEqual(pushRecentSearch("mobile_quicksearch_v1", "Lagos"), []);
    clearRecentSearches("mobile_quicksearch_v1");
  } finally {
    if (previousWindow !== undefined) {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
});
