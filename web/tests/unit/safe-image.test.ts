import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  shouldBypassNextImageOptimizer,
  shouldUpgradeImageUrlToHttps,
} from "@/lib/media/safe-image";

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
  assert.match(source, /import \{ shouldBypassNextImageOptimizer \} from "@\/lib\/media\/safe-image"/);
  assert.match(source, /const bypassOptimizer = useMemo\(\(\) => shouldBypassNextImageOptimizer\(src\), \[src\]\)/);
  assert.match(source, /unoptimized=\{bypassOptimizer\}/);
  assert.match(source, /loader=\{bypassOptimizer \? directImageLoader : undefined\}/);
});
