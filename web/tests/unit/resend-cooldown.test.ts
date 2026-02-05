import test from "node:test";
import assert from "node:assert/strict";
import { getCooldownRemaining, startCooldown } from "@/lib/auth/resendCooldown";

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

void test("resend cooldown stores and expires", () => {
  const storage = new LocalStorageMock();
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalNow = Date.now;

  (globalThis as { window?: unknown }).window = { localStorage: storage };

  Date.now = () => 1_000;
  startCooldown("reset:test@example.com", 60);
  assert.equal(getCooldownRemaining("reset:test@example.com"), 60);

  Date.now = () => 31_000;
  assert.equal(getCooldownRemaining("reset:test@example.com"), 30);

  Date.now = () => 62_000;
  assert.equal(getCooldownRemaining("reset:test@example.com"), 0);

  Date.now = originalNow;
  (globalThis as { window?: unknown }).window = originalWindow;
});
