import test from "node:test";
import assert from "node:assert/strict";
import {
  MARKETPLACE_DISCLAIMER_STORAGE_KEY,
  MARKETPLACE_DISCLAIMER_VERSION,
  dismissMarketplaceDisclaimer,
  getMarketplaceDisclaimerDismissedVersion,
  isMarketplaceDisclaimerDismissed,
  shouldRenderMarketplaceDisclaimer,
} from "@/lib/legal/marketplace-disclaimer";

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

void test("banner should not render when dismissed version matches current version", () => {
  const storage = new LocalStorageMock();
  storage.setItem(
    MARKETPLACE_DISCLAIMER_STORAGE_KEY,
    MARKETPLACE_DISCLAIMER_VERSION
  );

  const dismissedVersion = getMarketplaceDisclaimerDismissedVersion(storage);
  assert.equal(dismissedVersion, MARKETPLACE_DISCLAIMER_VERSION);
  assert.equal(shouldRenderMarketplaceDisclaimer(dismissedVersion), false);
  assert.equal(isMarketplaceDisclaimerDismissed(storage), true);
});

void test("dismissing stores current version and marks banner dismissed", () => {
  const storage = new LocalStorageMock();

  dismissMarketplaceDisclaimer(storage);

  assert.equal(
    storage.getItem(MARKETPLACE_DISCLAIMER_STORAGE_KEY),
    MARKETPLACE_DISCLAIMER_VERSION
  );
  assert.equal(isMarketplaceDisclaimerDismissed(storage), true);
  assert.equal(
    shouldRenderMarketplaceDisclaimer(
      getMarketplaceDisclaimerDismissedVersion(storage)
    ),
    false
  );
});
