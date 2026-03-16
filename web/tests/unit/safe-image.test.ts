import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  shouldBypassNextImageOptimizer,
  shouldUpgradeImageUrlToHttps,
} from "@/lib/media/safe-image";
import {
  normalizeImageOptimizationMode,
  shouldDisableImageOptimizationForUsage,
} from "@/lib/media/image-optimization-mode";

void test("safe-image bypasses Next optimizer for Supabase storage hosts", () => {
  assert.equal(
    shouldBypassNextImageOptimizer("https://vfospznoluqoklmgjgea.supabase.co/storage/v1/object/public/a.webp"),
    true
  );
  assert.equal(
    shouldBypassNextImageOptimizer("https://images.unsplash.com/photo-123?auto=format"),
    true
  );
  assert.equal(shouldBypassNextImageOptimizer("https://example.com/image.webp"), false);
  assert.equal(shouldBypassNextImageOptimizer("/local-placeholder.jpg"), false);
});

void test("safe-image upgrades insecure bypass URLs to https only when needed", () => {
  assert.equal(shouldUpgradeImageUrlToHttps("http://vfospznoluqoklmgjgea.supabase.co/storage/v1/object/public/a.webp"), true);
  assert.equal(shouldUpgradeImageUrlToHttps("https://vfospznoluqoklmgjgea.supabase.co/storage/v1/object/public/a.webp"), false);
  assert.equal(shouldUpgradeImageUrlToHttps("http://example.com/image.webp"), false);
});

void test("SafeImage uses next/image with unoptimized mode when bypass host matches", () => {
  const filePath = path.join(process.cwd(), "components", "ui", "SafeImage.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /import Image, \{ type ImageLoader, type ImageProps \} from "next\/image"/);
  assert.match(source, /useImageOptimizationMode/);
  assert.match(source, /shouldDisableImageOptimizationForUsage/);
  assert.match(source, /const bypassOptimizer = useMemo\(\(\) => shouldBypassNextImageOptimizer\(src\), \[src\]\)/);
  assert.match(source, /usage = "noncritical"/);
  assert.match(source, /const unoptimized = useMemo/);
  assert.match(source, /unoptimized=\{unoptimized\}/);
  assert.match(source, /loader=\{unoptimized \? directImageLoader : undefined\}/);
});

void test("image optimisation mode normalizes supported values and falls back safely", () => {
  assert.equal(normalizeImageOptimizationMode("vercel_default"), "vercel_default");
  assert.equal(
    normalizeImageOptimizationMode({ value: "disable_non_critical" }),
    "disable_non_critical"
  );
  assert.equal(normalizeImageOptimizationMode({ value: "disable_all" }), "disable_all");
  assert.equal(normalizeImageOptimizationMode({ value: "bad-mode" }), "vercel_default");
});

void test("image optimisation mode resolver respects usage and hard bypass rules", () => {
  assert.equal(
    shouldDisableImageOptimizationForUsage({
      mode: "vercel_default",
      usage: "noncritical",
      bypassOptimizer: false,
    }),
    false
  );
  assert.equal(
    shouldDisableImageOptimizationForUsage({
      mode: "disable_non_critical",
      usage: "noncritical",
      bypassOptimizer: false,
    }),
    true
  );
  assert.equal(
    shouldDisableImageOptimizationForUsage({
      mode: "disable_non_critical",
      usage: "critical",
      bypassOptimizer: false,
    }),
    false
  );
  assert.equal(
    shouldDisableImageOptimizationForUsage({
      mode: "disable_all",
      usage: "critical",
      bypassOptimizer: false,
    }),
    true
  );
  assert.equal(
    shouldDisableImageOptimizationForUsage({
      mode: "vercel_default",
      usage: "critical",
      bypassOptimizer: true,
    }),
    true
  );
});
