import test from "node:test";
import assert from "node:assert/strict";
import {
  clearViewedItems,
  getViewedItems,
  parseViewedStoreValue,
  pushViewedItem,
} from "@/lib/viewed";

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
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

void test("viewed store is SSR-safe without window/localStorage", () => {
  const globalAny = globalThis as unknown as { window?: Record<string, unknown> };
  const previousWindow = globalAny.window;
  delete globalAny.window;
  try {
    assert.deepEqual(getViewedItems(), []);
    assert.deepEqual(clearViewedItems(), []);
    assert.deepEqual(
      pushViewedItem({
        id: "abc",
        kind: "shortlet",
        marketCountry: "NG",
        href: "/shortlets?where=Lekki",
      }),
      []
    );
  } finally {
    globalAny.window = previousWindow;
  }
});

void test("viewed store dedupes by market + kind + id and updates timestamp", async () => {
  withWindowMock(() => {
    const first = pushViewedItem({
      id: "item-a",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=Lekki",
      title: "Lekki shortlet",
    });
    assert.equal(first.length, 1);

    const second = pushViewedItem({
      id: "item-a",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=Lekki",
      title: "Lekki shortlet",
    });
    assert.equal(second.length, 1);
    assert.equal(second[0]?.id, "item-a");
  });
});

void test("viewed store scopes by market and kind", () => {
  withWindowMock(() => {
    pushViewedItem({
      id: "ng-shortlet",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=Lekki",
    });
    pushViewedItem({
      id: "ng-property",
      kind: "property",
      marketCountry: "NG",
      href: "/properties?city=Lagos",
    });
    pushViewedItem({
      id: "ca-shortlet",
      kind: "shortlet",
      marketCountry: "CA",
      href: "/shortlets?where=Toronto",
    });

    assert.equal(getViewedItems().length, 3);
    assert.equal(getViewedItems({ marketCountry: "NG" }).length, 2);
    assert.equal(getViewedItems({ marketCountry: "NG", kind: "shortlet" }).length, 1);
    assert.equal(getViewedItems({ marketCountry: "CA", kind: "shortlet" }).length, 1);
  });
});

void test("viewed store trims to max and tolerates corrupt payload", () => {
  withWindowMock(() => {
    for (let index = 0; index < 80; index += 1) {
      pushViewedItem({
        id: `item-${index}`,
        kind: "property",
        marketCountry: "US",
        href: `/properties?city=City-${index}`,
      });
    }
    const items = getViewedItems();
    assert.equal(items.length, 30);

    assert.deepEqual(parseViewedStoreValue("not-json"), []);
  });
});

void test("clearViewedItems can clear one market or all", () => {
  withWindowMock(() => {
    pushViewedItem({
      id: "ng-item",
      kind: "property",
      marketCountry: "NG",
      href: "/properties?city=Lagos",
    });
    pushViewedItem({
      id: "uk-item",
      kind: "property",
      marketCountry: "UK",
      href: "/properties?city=London",
    });

    clearViewedItems({ marketCountry: "NG" });
    assert.equal(getViewedItems({ marketCountry: "NG" }).length, 0);
    assert.equal(getViewedItems({ marketCountry: "UK" }).length, 1);

    clearViewedItems();
    assert.equal(getViewedItems().length, 0);
  });
});
