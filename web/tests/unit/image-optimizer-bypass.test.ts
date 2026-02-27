import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldBypassNextImageOptimizer,
  shouldUpgradeImageUrlToHttps,
} from "@/lib/images/optimizer-bypass";

void test("bypass optimizer for supported remote hosts", () => {
  assert.equal(
    shouldBypassNextImageOptimizer("https://vfospznoluqoklmgjgea.supabase.co/storage/v1/object/public/a.webp"),
    true
  );
  assert.equal(
    shouldBypassNextImageOptimizer("https://images.unsplash.com/photo-123?auto=format"),
    true
  );
});

void test("do not bypass optimizer for local or unsupported hosts", () => {
  assert.equal(shouldBypassNextImageOptimizer("/og-propatyhub.png"), false);
  assert.equal(shouldBypassNextImageOptimizer("https://example.com/image.webp"), false);
});

void test("upgrade only supported http hosts to https", () => {
  assert.equal(
    shouldUpgradeImageUrlToHttps("http://vfospznoluqoklmgjgea.supabase.co/storage/v1/object/public/a.webp"),
    true
  );
  assert.equal(shouldUpgradeImageUrlToHttps("http://example.com/image.webp"), false);
  assert.equal(
    shouldUpgradeImageUrlToHttps("https://vfospznoluqoklmgjgea.supabase.co/storage/v1/object/public/a.webp"),
    false
  );
});
