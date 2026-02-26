import test from "node:test";
import assert from "node:assert/strict";
import {
  clearLastBrowseUrl,
  getLastBrowseUrl,
  isAllowedBrowseHref,
  setLastBrowseUrl,
} from "@/lib/viewed";

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createStorageMock(): StorageMock {
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
    clear() {
      store.clear();
    },
  };
}

function withWindowMock(fn: () => void) {
  const globalAny = globalThis as unknown as {
    window?: Record<string, unknown>;
  };
  const previousWindow = globalAny.window;
  const localStorage = createStorageMock();
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  globalAny.window = {
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
  } as unknown as Record<string, unknown>;

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

void test("browse-state is SSR-safe without window", () => {
  const globalAny = globalThis as unknown as { window?: Record<string, unknown> };
  const previousWindow = globalAny.window;
  delete globalAny.window;
  try {
    assert.equal(
      getLastBrowseUrl({
        kind: "shortlet",
        marketCountry: "NG",
      }),
      null
    );
    assert.equal(
      setLastBrowseUrl({
        kind: "shortlet",
        marketCountry: "NG",
        href: "/shortlets?where=Lekki",
      }),
      null
    );
  } finally {
    globalAny.window = previousWindow;
  }
});

void test("browse-state accepts only whitelisted routes with query params", () => {
  assert.equal(isAllowedBrowseHref("/shortlets?where=Lekki"), true);
  assert.equal(isAllowedBrowseHref("/properties?city=Lagos"), true);
  assert.equal(isAllowedBrowseHref("/properties"), false);
  assert.equal(isAllowedBrowseHref("/host/listings?view=manage"), false);
  assert.equal(isAllowedBrowseHref("https://example.com/shortlets?where=Lekki"), false);
});

void test("browse-state persists and reads per market + kind", () => {
  withWindowMock(() => {
    setLastBrowseUrl({
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=Lekki&guests=2",
    });
    setLastBrowseUrl({
      kind: "shortlet",
      marketCountry: "CA",
      href: "/shortlets?where=Toronto&guests=1",
    });
    setLastBrowseUrl({
      kind: "property",
      marketCountry: "NG",
      href: "/properties?intent=rent&city=Lagos",
    });

    assert.equal(
      getLastBrowseUrl({
        kind: "shortlet",
        marketCountry: "NG",
      }),
      "/shortlets?where=Lekki&guests=2"
    );
    assert.equal(
      getLastBrowseUrl({
        kind: "shortlet",
        marketCountry: "CA",
      }),
      "/shortlets?where=Toronto&guests=1"
    );
    assert.equal(
      getLastBrowseUrl({
        kind: "property",
        marketCountry: "NG",
      }),
      "/properties?intent=rent&city=Lagos"
    );
  });
});

void test("browse-state rejects invalid URLs and supports clear", () => {
  withWindowMock(() => {
    setLastBrowseUrl({
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=Lekki",
    });

    const invalidWrite = setLastBrowseUrl({
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets",
    });
    assert.equal(invalidWrite, null);
    assert.equal(
      getLastBrowseUrl({
        kind: "shortlet",
        marketCountry: "NG",
      }),
      "/shortlets?where=Lekki"
    );

    clearLastBrowseUrl({
      kind: "shortlet",
      marketCountry: "NG",
    });
    assert.equal(
      getLastBrowseUrl({
        kind: "shortlet",
        marketCountry: "NG",
      }),
      null
    );
  });
});
