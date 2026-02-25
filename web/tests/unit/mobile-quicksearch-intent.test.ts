import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultIntentForMarket,
  readStoredIntentForMarket,
  resolveIntentForMarket,
  writeStoredIntentForMarket,
} from "@/lib/home/mobile-quicksearch-intent";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function withWindowStorage(run: () => void) {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const localStorageMock = createStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { localStorage: localStorageMock },
  });
  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow,
    });
  }
}

void test("market defaults are deterministic and country-aware", () => {
  assert.equal(getDefaultIntentForMarket("NG"), "shortlet");
  assert.equal(getDefaultIntentForMarket("CA"), "rent");
  assert.equal(getDefaultIntentForMarket("US"), "rent");
  assert.equal(getDefaultIntentForMarket("ZZ"), "rent");
});

void test("stored intent persists per market key and does not leak across markets", () => {
  withWindowStorage(() => {
    writeStoredIntentForMarket("US", "buy");
    writeStoredIntentForMarket("NG", "shortlet");

    assert.equal(readStoredIntentForMarket("US"), "buy");
    assert.equal(readStoredIntentForMarket("NG"), "shortlet");
    assert.equal(readStoredIntentForMarket("CA"), null);
  });
});

void test("resolveIntentForMarket prefers stored intent and falls back to defaults", () => {
  withWindowStorage(() => {
    assert.equal(resolveIntentForMarket("UK"), "rent");
    writeStoredIntentForMarket("UK", "buy");
    assert.equal(resolveIntentForMarket("UK"), "buy");
  });
});
