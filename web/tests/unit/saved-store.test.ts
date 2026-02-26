import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSavedItems,
  clearSavedSection,
  getSavedItems,
  groupSavedItemsByKind,
  isSavedItem,
  parseSavedStoreValue,
  removeSavedItem,
  toggleSavedItem,
} from "@/lib/saved";

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

void test("saved store is SSR-safe without window/localStorage", () => {
  const globalAny = globalThis as unknown as {
    window?: Record<string, unknown>;
  };
  const previousWindow = globalAny.window;
  delete globalAny.window;

  try {
    assert.deepEqual(getSavedItems(), []);
    assert.equal(isSavedItem("abc", "NG"), false);
    assert.deepEqual(clearSavedItems(), []);
    const toggled = toggleSavedItem({
      id: "abc",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=Lekki",
      title: "Lekki stay",
    });
    assert.equal(toggled.saved, false);
    assert.deepEqual(toggled.items, []);
  } finally {
    globalAny.window = previousWindow;
  }
});

void test("saved store toggles items on and off", () => {
  withWindowMock(() => {
    const first = toggleSavedItem({
      id: "ng-shortlet-lagoon",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=Lekki",
      title: "Lagoon view",
      subtitle: "Near beach",
      tag: "Shortlets",
    });

    assert.equal(first.saved, true);
    assert.equal(first.items.length, 1);
    assert.equal(isSavedItem("ng-shortlet-lagoon", "NG"), true);

    const second = toggleSavedItem({
      id: "ng-shortlet-lagoon",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=Lekki",
      title: "Lagoon view",
    });

    assert.equal(second.saved, false);
    assert.equal(second.items.length, 0);
    assert.equal(isSavedItem("ng-shortlet-lagoon", "NG"), false);
  });
});

void test("saved store dedupes by id + market and scopes reads by market", () => {
  withWindowMock(() => {
    toggleSavedItem({
      id: "same-item",
      kind: "property",
      marketCountry: "NG",
      href: "/properties?city=Lagos",
      title: "Lagos listing",
    });
    toggleSavedItem({
      id: "same-item",
      kind: "property",
      marketCountry: "US",
      href: "/properties?city=Boston",
      title: "Boston listing",
    });

    const ng = getSavedItems({ marketCountry: "NG" });
    const us = getSavedItems({ marketCountry: "US" });
    const all = getSavedItems();

    assert.equal(ng.length, 1);
    assert.equal(us.length, 1);
    assert.equal(all.length, 2);
    assert.equal(ng[0]?.title, "Lagos listing");
    assert.equal(us[0]?.title, "Boston listing");
  });
});

void test("saved store caps records and tolerates corrupted payload", () => {
  withWindowMock(() => {
    for (let index = 0; index < 130; index += 1) {
      toggleSavedItem({
        id: `item-${index}`,
        kind: "property",
        marketCountry: "CA",
        href: `/properties?city=city-${index}`,
        title: `Item ${index}`,
      });
    }

    const capped = getSavedItems();
    assert.equal(capped.length, 100);

    const parsed = parseSavedStoreValue("not-json");
    assert.deepEqual(parsed, []);
  });
});

void test("clearSavedItems removes only target market when requested", () => {
  withWindowMock(() => {
    toggleSavedItem({
      id: "ng-a",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=lagos",
      title: "NG",
    });
    toggleSavedItem({
      id: "uk-a",
      kind: "shortlet",
      marketCountry: "UK",
      href: "/shortlets?where=london",
      title: "UK",
    });

    clearSavedItems({ marketCountry: "NG" });

    assert.equal(getSavedItems({ marketCountry: "NG" }).length, 0);
    assert.equal(getSavedItems({ marketCountry: "UK" }).length, 1);
  });
});

void test("removeSavedItem removes only the requested id and market scope", () => {
  withWindowMock(() => {
    toggleSavedItem({
      id: "shared-item",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=lagos",
      title: "NG shortlet",
    });
    toggleSavedItem({
      id: "shared-item",
      kind: "shortlet",
      marketCountry: "US",
      href: "/shortlets?where=austin",
      title: "US shortlet",
    });

    removeSavedItem({ id: "shared-item", marketCountry: "NG" });

    assert.equal(getSavedItems({ marketCountry: "NG" }).length, 0);
    assert.equal(getSavedItems({ marketCountry: "US" }).length, 1);
  });
});

void test("clearSavedSection clears only one kind in a market", () => {
  withWindowMock(() => {
    toggleSavedItem({
      id: "ng-shortlet-1",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets?where=lagos",
      title: "Shortlet",
    });
    toggleSavedItem({
      id: "ng-property-1",
      kind: "property",
      marketCountry: "NG",
      href: "/properties?intent=rent",
      title: "Property",
    });

    clearSavedSection({ kind: "shortlet", marketCountry: "NG" });

    assert.equal(getSavedItems({ marketCountry: "NG" }).length, 1);
    assert.equal(getSavedItems({ marketCountry: "NG" })[0]?.kind, "property");
  });
});

void test("groupSavedItemsByKind returns split shortlet/property arrays", () => {
  const grouped = groupSavedItemsByKind([
    {
      id: "a",
      kind: "shortlet",
      marketCountry: "NG",
      href: "/shortlets",
      title: "A",
      savedAt: "2026-02-26T00:00:00.000Z",
    },
    {
      id: "b",
      kind: "property",
      marketCountry: "NG",
      href: "/properties",
      title: "B",
      savedAt: "2026-02-26T00:00:00.000Z",
    },
  ]);

  assert.equal(grouped.shortlets.length, 1);
  assert.equal(grouped.properties.length, 1);
});
