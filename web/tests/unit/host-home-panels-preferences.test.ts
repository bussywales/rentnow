import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHostHomePanelOpenStorageKey,
  parseHostHomePanelOpenPreference,
  readHostHomePanelOpenPreference,
  toggleHostHomePanelOpenPreference,
  writeHostHomePanelOpenPreference,
} from "@/lib/host/home-panels-preferences";

function createMemoryStorage(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

void test("host home panel keys follow the stable workspace pattern", () => {
  assert.equal(
    buildHostHomePanelOpenStorageKey("analytics_preview"),
    "host:home:panel:analytics_preview:open:v1"
  );
  assert.equal(
    buildHostHomePanelOpenStorageKey("demand_alerts"),
    "host:home:panel:demand_alerts:open:v1"
  );
});

void test("panel preference parsing respects defaults", () => {
  assert.equal(parseHostHomePanelOpenPreference("1", false), true);
  assert.equal(parseHostHomePanelOpenPreference("0", true), false);
  assert.equal(parseHostHomePanelOpenPreference(null, true), true);
});

void test("panel preference helpers persist and toggle open state", () => {
  const storage = createMemoryStorage();
  writeHostHomePanelOpenPreference(storage, "snapshot", false);
  assert.equal(readHostHomePanelOpenPreference(storage, "snapshot", true), false);

  const toggled = toggleHostHomePanelOpenPreference(storage, "snapshot", false);
  assert.equal(toggled, true);
  assert.equal(readHostHomePanelOpenPreference(storage, "snapshot", false), true);
});
