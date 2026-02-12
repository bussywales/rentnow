import test from "node:test";
import assert from "node:assert/strict";
import {
  BROWSE_INTENT_DISMISS_SESSION_KEY,
  BROWSE_INTENT_STORAGE_KEY,
  clearLastBrowseIntent,
  dismissBrowseContinueForSession,
  extractSearchParamsFromHref,
  getLastBrowseIntent,
  getRecentBrowseIntent,
  isBrowseContinueDismissed,
  isBrowseIntentRecent,
  setLastBrowseIntent,
} from "@/lib/market/browse-intent";

class StorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

void test("browse intent set/get/clear lifecycle", () => {
  const storage = new StorageMock();
  setLastBrowseIntent(
    {
      lastSearchParams: "?city=Lagos&bedrooms=2",
      lastHub: { country: "NG", label: "Lagos", href: "/properties?city=Lagos" },
    },
    storage
  );

  const state = getLastBrowseIntent(storage);
  assert.ok(state);
  assert.equal(state?.lastSearchParams, "?city=Lagos&bedrooms=2");
  assert.equal(state?.lastHub?.label, "Lagos");
  assert.ok(storage.getItem(BROWSE_INTENT_STORAGE_KEY));

  clearLastBrowseIntent(storage);
  assert.equal(getLastBrowseIntent(storage), null);
});

void test("browse intent recency gating returns only fresh records", () => {
  const storage = new StorageMock();
  const baseNow = Date.now();
  const originalNow = Date.now;

  Date.now = () => baseNow;
  setLastBrowseIntent({ lastSearchParams: "?city=Abuja" }, storage);
  const fresh = getLastBrowseIntent(storage);
  assert.equal(isBrowseIntentRecent(fresh, 14, baseNow), true);
  assert.ok(getRecentBrowseIntent(14, storage, baseNow));

  Date.now = () => baseNow + 15 * 24 * 60 * 60 * 1000;
  assert.equal(getRecentBrowseIntent(14, storage, Date.now()), null);

  Date.now = originalNow;
});

void test("dismiss flag is session-scoped", () => {
  const session = new StorageMock();
  assert.equal(isBrowseContinueDismissed(session), false);
  dismissBrowseContinueForSession(session);
  assert.equal(session.getItem(BROWSE_INTENT_DISMISS_SESSION_KEY), "1");
  assert.equal(isBrowseContinueDismissed(session), true);
});

void test("extractSearchParamsFromHref reads query strings safely", () => {
  assert.equal(extractSearchParamsFromHref("/properties?city=Lagos"), "?city=Lagos");
  assert.equal(extractSearchParamsFromHref("?city=Abuja&bedrooms=2"), "?city=Abuja&bedrooms=2");
  assert.equal(extractSearchParamsFromHref("/properties"), null);
});

