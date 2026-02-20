import test from "node:test";
import assert from "node:assert/strict";
import { getSavedIds, isSaved, toggleSaved } from "@/lib/shortlet/saved.client";

type MemoryStorage = {
  state: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createMemoryStorage(seed?: string): MemoryStorage {
  const state: Record<string, string> = {};
  if (typeof seed === "string") {
    state["shortlets:saved"] = seed;
  }
  return {
    state,
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(state, key) ? state[key] : null),
    setItem: (key: string, value: string) => {
      state[key] = value;
    },
    removeItem: (key: string) => {
      delete state[key];
    },
  };
}

void test("toggleSaved adds and removes listing ids with deterministic state", () => {
  const storage = createMemoryStorage();

  const added = toggleSaved("listing-1", storage);
  assert.equal(added.saved, true);
  assert.deepEqual(added.ids, ["listing-1"]);
  assert.equal(isSaved("listing-1", storage), true);

  const removed = toggleSaved("listing-1", storage);
  assert.equal(removed.saved, false);
  assert.deepEqual(removed.ids, []);
  assert.equal(isSaved("listing-1", storage), false);
});

void test("getSavedIds returns newest entries first and trims invalid payloads", () => {
  const storage = createMemoryStorage(
    JSON.stringify([
      { id: "listing-a", savedAt: "2026-02-19T10:00:00.000Z" },
      { id: "", savedAt: "bad" },
      { id: "listing-b" },
    ])
  );

  assert.deepEqual(getSavedIds(storage), ["listing-a", "listing-b"]);
});
