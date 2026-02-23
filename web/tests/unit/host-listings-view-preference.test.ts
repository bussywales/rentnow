import test from "node:test";
import assert from "node:assert/strict";
import {
  HOST_LISTINGS_VIEW_STORAGE_KEY,
  parseHostListingsView,
  readHostListingsView,
  writeHostListingsView,
} from "@/lib/host/listings-view-preference";

void test("host listings view preference parses storage values safely", () => {
  assert.equal(parseHostListingsView("grid"), "grid");
  assert.equal(parseHostListingsView("rail"), "rail");
  assert.equal(parseHostListingsView("unexpected"), "grid");
  assert.equal(parseHostListingsView(null), "grid");
});

void test("host listings view preference reads and writes local storage key", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };

  assert.equal(readHostListingsView(storage), "grid");
  assert.equal(writeHostListingsView(storage, "rail"), "rail");
  assert.equal(values.get(HOST_LISTINGS_VIEW_STORAGE_KEY), "rail");
  assert.equal(readHostListingsView(storage), "rail");
});
