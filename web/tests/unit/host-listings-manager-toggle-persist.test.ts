import test from "node:test";
import assert from "node:assert/strict";
import {
  HOST_LISTINGS_MANAGER_VIEW_STORAGE_KEY,
  parseHostListingsManagerView,
  readHostListingsManagerView,
  writeHostListingsManagerView,
} from "@/lib/host/listings-manager-view";

void test("host listings manager view parser only accepts portfolio/manage values", () => {
  assert.equal(parseHostListingsManagerView("portfolio"), "portfolio");
  assert.equal(parseHostListingsManagerView("manage"), "manage");
  assert.equal(parseHostListingsManagerView("grid"), null);
  assert.equal(parseHostListingsManagerView(null), null);
});

void test("host listings manager toggle persists to local storage key", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  assert.equal(readHostListingsManagerView(storage), "portfolio");
  assert.equal(writeHostListingsManagerView(storage, "manage"), "manage");
  assert.equal(store.get(HOST_LISTINGS_MANAGER_VIEW_STORAGE_KEY), "manage");
  assert.equal(readHostListingsManagerView(storage), "manage");
});
