import test from "node:test";
import assert from "node:assert/strict";
import { buildStaticMapUrl } from "@/lib/geocode/staticMap";

void test("buildStaticMapUrl returns null without token", () => {
  const original = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  assert.equal(buildStaticMapUrl({ lat: 1, lng: 2 }), null);
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = original;
});

void test("buildStaticMapUrl clamps size and includes coords", () => {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test-token";
  const url = buildStaticMapUrl({ lat: 6.5, lng: 3.3, width: 5000, height: 50 });
  assert.ok(url);
  assert.ok(url!.includes("6.5"));
  assert.ok(url!.includes("3.3"));
  assert.ok(url!.includes("1280x100"));
});
