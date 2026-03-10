import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  clearExploreAnalyticsEvents,
  EXPLORE_ANALYTICS_MAX_EVENTS,
  getExploreAnalyticsEvents,
  getOrCreateExploreAnalyticsSessionId,
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
  const parsed = parseExploreAnalyticsPayload(
    JSON.stringify({
      events: [{ name: "explore_view", at: "2026-02-28T12:00:00.000Z", marketCountry: "GB" }],
    })
  );
  assert.equal(parsed.events[0]?.marketCode, "GB");
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

void test("explore analytics sessions persist across activity and rotate after idle timeout", () => {
  withMockWindow(() => {
    clearExploreAnalyticsEvents();
    const firstSession = getOrCreateExploreAnalyticsSessionId({ nowMs: 1000 });
    recordExploreAnalyticsEvent({ name: "explore_view", nowMs: 1000 });
    const sameSession = getOrCreateExploreAnalyticsSessionId({ nowMs: 1000 + 5 * 60 * 1000 });
    recordExploreAnalyticsEvent({ name: "explore_swipe", nowMs: 1000 + 5 * 60 * 1000 });
    const rotatedSession = getOrCreateExploreAnalyticsSessionId({ nowMs: 1000 + 36 * 60 * 1000 });
    assert.ok(firstSession);
    assert.equal(firstSession, sameSession);
    assert.notEqual(rotatedSession, firstSession);
  });
});

void test("explore analytics events keep non-creepy payload keys only", () => {
  withMockWindow(() => {
    clearExploreAnalyticsEvents();
    recordExploreAnalyticsEvent({
      name: "explore_tap_cta",
      listingId: "listing-42",
      marketCode: "GB",
      intentType: "rent",
      index: 3,
      feedSize: 20,
      action: "request_viewing",
      result: "attempt",
      trustCueVariant: "none",
      trustCueEnabled: false,
    });
    const [event] = getExploreAnalyticsEvents();
    assert.equal(event?.name, "explore_tap_cta");
    assert.equal(event?.marketCode, "GB");
    assert.equal(event?.intentType, "rent");
    assert.equal(event?.index, 3);
    assert.equal(event?.feedSize, 20);
    assert.equal(event?.trustCueVariant, "none");
    assert.equal(event?.trustCueEnabled, false);
    const eventRecord = event as Record<string, unknown>;
    assert.equal(eventRecord.message, undefined);
    assert.equal(eventRecord.email, undefined);
    assert.equal(eventRecord.phone, undefined);
  });
});

void test("explore source records funnel events across pager and details sheet", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePager.tsx");
  const detailsPath = path.join(process.cwd(), "components", "explore", "ExploreDetailsSheet.tsx");
  const source = readFileSync(sourcePath, "utf8");
  const detailsSource = readFileSync(detailsPath, "utf8");

  assert.match(source, /name: "explore_view"/);
  assert.match(source, /name: "explore_swipe"/);
  assert.match(source, /name: "explore_open_details"/);
  assert.match(source, /name: "explore_tap_cta"/);
  assert.match(source, /name: "explore_save_toggle"/);
  assert.match(source, /name: "explore_share"/);
  assert.match(source, /name: "explore_not_interested"/);
  assert.match(detailsSource, /name: "explore_open_next_steps"/);
  assert.match(detailsSource, /name: "explore_open_request_composer"/);
  assert.match(detailsSource, /name: "explore_submit_request_attempt"/);
  assert.match(detailsSource, /name: "explore_submit_request_success"/);
  assert.match(detailsSource, /name: "explore_submit_request_fail"/);
  assert.match(detailsSource, /name: "explore_continue_booking"/);
});

void test("explore-v2 conversion sheet source records consent-aware micro-action events", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore-v2", "ExploreV2Card.tsx");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /name: "explore_v2_cta_sheet_opened"/);
  assert.match(source, /name: "explore_v2_cta_primary_clicked"/);
  assert.match(source, /name: "explore_v2_cta_view_details_clicked"/);
  assert.match(source, /name: "explore_v2_cta_save_clicked"/);
  assert.match(source, /name: "explore_v2_cta_share_clicked"/);
});
