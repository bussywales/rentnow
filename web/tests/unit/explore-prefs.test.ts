import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPLORE_MAX_HIDDEN_IDS,
  getHiddenExploreListingIds,
  hasSeenExploreDetailsHint,
  hideExploreListingId,
  markExploreDetailsHintSeen,
  parseExplorePrefs,
  unhideExploreListingId,
} from "@/lib/explore/explore-prefs";

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createLocalStorageMock(): LocalStorageMock {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

function withWindowMock(fn: () => void) {
  const globalAny = globalThis as unknown as {
    window?: Record<string, unknown>;
  };
  const previousWindow = globalAny.window;
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const localStorage = createLocalStorageMock();

  const windowMock = {
    localStorage,
    addEventListener(type: string, listener: (...args: unknown[]) => void) {
      const set = listeners.get(type) ?? new Set<(...args: unknown[]) => void>();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: (...args: unknown[]) => void) {
      const set = listeners.get(type);
      if (!set) return;
      set.delete(listener);
    },
    dispatchEvent(event: { type: string }) {
      const set = listeners.get(event.type);
      if (!set) return true;
      for (const listener of set) listener(event);
      return true;
    },
  };

  globalAny.window = windowMock as unknown as Record<string, unknown>;
  try {
    fn();
  } finally {
    if (typeof previousWindow === "undefined") {
      delete globalAny.window;
    } else {
      globalAny.window = previousWindow;
    }
  }
}

void test("explore prefs are SSR-safe without window/localStorage", () => {
  const globalAny = globalThis as unknown as { window?: Record<string, unknown> };
  const previousWindow = globalAny.window;
  delete globalAny.window;
  try {
    assert.equal(hasSeenExploreDetailsHint(), false);
    assert.deepEqual(getHiddenExploreListingIds(), []);
    assert.deepEqual(hideExploreListingId("abc"), []);
    assert.deepEqual(unhideExploreListingId("abc"), []);
  } finally {
    globalAny.window = previousWindow;
  }
});

void test("explore prefs track hint seen once", () => {
  withWindowMock(() => {
    assert.equal(hasSeenExploreDetailsHint(), false);
    assert.equal(markExploreDetailsHintSeen(), true);
    assert.equal(hasSeenExploreDetailsHint(), true);
  });
});

void test("explore prefs hidden ids dedupe and remove correctly", () => {
  withWindowMock(() => {
    hideExploreListingId("listing-a");
    hideExploreListingId("listing-b");
    hideExploreListingId("listing-a");

    assert.deepEqual(getHiddenExploreListingIds(), ["listing-a", "listing-b"]);

    unhideExploreListingId("listing-a");
    assert.deepEqual(getHiddenExploreListingIds(), ["listing-b"]);
  });
});

void test("explore prefs hidden ids cap at max entries", () => {
  withWindowMock(() => {
    for (let index = 0; index < EXPLORE_MAX_HIDDEN_IDS + 25; index += 1) {
      hideExploreListingId(`listing-${index}`);
    }

    assert.equal(getHiddenExploreListingIds().length, EXPLORE_MAX_HIDDEN_IDS);
  });
});

void test("parseExplorePrefs tolerates malformed payloads", () => {
  assert.deepEqual(parseExplorePrefs("not-json"), {
    version: 1,
    seenDetailsHint: false,
    hiddenListingIds: [],
  });

  assert.deepEqual(parseExplorePrefs(JSON.stringify({ seenDetailsHint: true, hiddenListingIds: ["a", 7, "a"] })), {
    version: 1,
    seenDetailsHint: true,
    hiddenListingIds: ["a"],
  });
});
