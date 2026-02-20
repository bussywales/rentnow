import assert from "node:assert/strict";
import test from "node:test";
import { createShortletMarkerIconCache, formatShortletPinPrice } from "@/lib/shortlet/map-marker-icons";

void test("marker icon cache reuses icon references for identical label and mode", () => {
  const cache = createShortletMarkerIconCache<{ id: string }>();
  const first = cache.get({
    label: "₦45,000",
    mode: "default",
    create: () => ({ id: "first" }),
  });
  const second = cache.get({
    label: "₦45,000",
    mode: "default",
    create: () => ({ id: "second" }),
  });
  assert.equal(first, second);
  assert.equal(first.id, "first");
});

void test("marker icon cache creates distinct references across modes", () => {
  const cache = createShortletMarkerIconCache<{ id: string }>();
  const base = cache.get({
    label: "₦45,000",
    mode: "default",
    create: () => ({ id: "base" }),
  });
  const hovered = cache.get({
    label: "₦45,000",
    mode: "hovered",
    create: () => ({ id: "hovered" }),
  });
  const selected = cache.get({
    label: "₦45,000",
    mode: "selected",
    create: () => ({ id: "selected" }),
  });
  assert.notEqual(base, hovered);
  assert.notEqual(hovered, selected);
});

void test("pin price formatter returns stable fallback and currency-aware labels", () => {
  assert.equal(formatShortletPinPrice("NGN", null), "₦—");
  assert.equal(formatShortletPinPrice("NGN", 4500000), "₦45,000");
  const gbp = formatShortletPinPrice("GBP", 1200000);
  assert.equal(gbp.includes("12,000") || gbp.includes("£12,000"), true);
});
