import test from "node:test";
import assert from "node:assert/strict";
import { resolveStorefrontViewState } from "@/lib/agents/storefront-view";

void test("resolveStorefrontViewState handles unavailable state", () => {
  const state = resolveStorefrontViewState({ ok: false, listingsCount: 2 });
  assert.equal(state, "unavailable");
});

void test("resolveStorefrontViewState handles empty state", () => {
  const state = resolveStorefrontViewState({ ok: true, listingsCount: 0 });
  assert.equal(state, "empty");
});

void test("resolveStorefrontViewState handles ready state", () => {
  const state = resolveStorefrontViewState({ ok: true, listingsCount: 3 });
  assert.equal(state, "ready");
});
