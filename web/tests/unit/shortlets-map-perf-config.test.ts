import assert from "node:assert/strict";
import test from "node:test";
import { resolveShortletsMapPerfConfig } from "@/lib/shortlet/map-perf-config";

void test("shortlets map perf config uses defaults when env overrides are missing", () => {
  const config = resolveShortletsMapPerfConfig({});
  assert.equal(config.clusterThreshold, 80);
  assert.equal(config.clusterEnabled, true);
  assert.equal(config.markerIconCacheEnabled, true);
});

void test("shortlets map perf config applies env overrides safely", () => {
  const config = resolveShortletsMapPerfConfig({
    NEXT_PUBLIC_SHORTLETS_CLUSTER_THRESHOLD: "120",
    NEXT_PUBLIC_SHORTLETS_CLUSTER_ENABLED: "0",
    NEXT_PUBLIC_SHORTLETS_ICON_CACHE_ENABLED: "false",
  });
  assert.equal(config.clusterThreshold, 120);
  assert.equal(config.clusterEnabled, false);
  assert.equal(config.markerIconCacheEnabled, false);
});

void test("shortlets map perf config falls back on invalid env values", () => {
  const config = resolveShortletsMapPerfConfig({
    NEXT_PUBLIC_SHORTLETS_CLUSTER_THRESHOLD: "invalid",
    NEXT_PUBLIC_SHORTLETS_CLUSTER_ENABLED: "maybe",
    NEXT_PUBLIC_SHORTLETS_ICON_CACHE_ENABLED: "unknown",
  });
  assert.equal(config.clusterThreshold, 80);
  assert.equal(config.clusterEnabled, true);
  assert.equal(config.markerIconCacheEnabled, true);
});
