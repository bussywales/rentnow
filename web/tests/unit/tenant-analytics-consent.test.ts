import test from "node:test";
import assert from "node:assert/strict";
import {
  clearExploreAnalyticsConsentForTests,
  dismissExploreAnalyticsNotice,
  getExploreAnalyticsConsentState,
  hasExploreAnalyticsConsent,
  setExploreAnalyticsConsentAccepted,
  shouldShowExploreAnalyticsNotice,
} from "@/lib/analytics/consent";

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
      store.set(key, value);
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
    value: { localStorage: createMockStorage() },
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

void test("tenant analytics consent defaults to unknown and notice is shown", () => {
  withMockWindow(() => {
    clearExploreAnalyticsConsentForTests();
    assert.equal(getExploreAnalyticsConsentState(), "unknown");
    assert.equal(hasExploreAnalyticsConsent(), false);
    assert.equal(
      shouldShowExploreAnalyticsNotice({
        noticeEnabled: true,
        consentRequired: false,
        nowMs: 1_000,
      }),
      true
    );
  });
});

void test("tenant analytics consent acceptance suppresses required-consent banner", () => {
  withMockWindow(() => {
    clearExploreAnalyticsConsentForTests();
    setExploreAnalyticsConsentAccepted(1_000);
    assert.equal(hasExploreAnalyticsConsent(), true);
    assert.equal(
      shouldShowExploreAnalyticsNotice({
        noticeEnabled: true,
        consentRequired: true,
        nowMs: 1_001,
      }),
      false
    );
  });
});

void test("tenant analytics dismissal hides optional notice during cooldown", () => {
  withMockWindow(() => {
    clearExploreAnalyticsConsentForTests();
    dismissExploreAnalyticsNotice(10_000);
    assert.equal(
      shouldShowExploreAnalyticsNotice({
        noticeEnabled: true,
        consentRequired: false,
        nowMs: 10_001,
      }),
      false
    );
    assert.equal(
      shouldShowExploreAnalyticsNotice({
        noticeEnabled: true,
        consentRequired: false,
        nowMs: 10_000 + 31 * 24 * 60 * 60 * 1000,
      }),
      true
    );
  });
});
