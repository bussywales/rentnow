import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  clearExploreAnalyticsEvents,
  EXPLORE_ANALYTICS_MAX_EVENTS,
  getExploreAnalyticsEvents,
  parseExploreAnalyticsPayload,
  recordExploreAnalyticsEvent,
} from "@/lib/explore/explore-analytics";

type StorageShape = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createMockStorage(): StorageShape {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function withMockWindow(run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: createMockStorage(),
    },
  });

  try {
    run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

void test("explore analytics parser tolerates invalid payloads", () => {
  assert.deepEqual(parseExploreAnalyticsPayload("not-json"), { events: [] });
  assert.deepEqual(parseExploreAnalyticsPayload(JSON.stringify({ events: [null, { name: "explore_view" }] })), {
    events: [],
  });
});

void test("explore analytics record/get/clear are SSR-safe", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  if (descriptor) {
    Reflect.deleteProperty(globalThis, "window");
  }

  try {
    assert.deepEqual(getExploreAnalyticsEvents(), []);
    assert.deepEqual(
      recordExploreAnalyticsEvent({
        name: "explore_view",
      }),
      []
    );
    assert.deepEqual(clearExploreAnalyticsEvents(), []);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    }
  }
});

void test("explore analytics event buffer caps and preserves latest events", () => {
  withMockWindow(() => {
    clearExploreAnalyticsEvents();

    for (let index = 0; index < EXPLORE_ANALYTICS_MAX_EVENTS + 11; index += 1) {
      recordExploreAnalyticsEvent({
        name: "explore_swipe",
        listingId: `listing-${index}`,
        depth: index + 1,
      });
    }

    const events = getExploreAnalyticsEvents();
    assert.equal(events.length, EXPLORE_ANALYTICS_MAX_EVENTS);
    assert.equal(events.at(-1)?.listingId, `listing-${EXPLORE_ANALYTICS_MAX_EVENTS + 10}`);
  });
});

void test("explore pager source records non-creepy action events", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePager.tsx");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /name: "explore_view"/);
  assert.match(source, /name: "explore_swipe"/);
  assert.match(source, /name: "explore_open_details"/);
  assert.match(source, /name: "explore_tap_cta"/);
  assert.match(source, /name: "explore_save_toggle"/);
  assert.match(source, /name: "explore_share"/);
  assert.match(source, /name: "explore_not_interested"/);
});
