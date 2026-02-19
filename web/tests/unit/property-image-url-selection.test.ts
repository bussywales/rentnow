import test from "node:test";
import assert from "node:assert/strict";
import { resolvePropertyImageUrl, resolveSupabasePublicUrlFromPath } from "@/lib/properties/image-url";

void test("resolvePropertyImageUrl prefers derivative path for card variant", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  const resolved = resolvePropertyImageUrl(
    {
      image_url: "https://legacy.example.com/original.jpg",
      card_storage_path: "properties/p-1/img-1/card.webp",
    },
    "card"
  );
  assert.equal(
    resolved,
    "https://example.supabase.co/storage/v1/object/public/property-images/properties/p-1/img-1/card.webp"
  );
});

void test("resolvePropertyImageUrl falls back to legacy url when derivative is missing", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  const resolved = resolvePropertyImageUrl({
    image_url: "https://legacy.example.com/original.jpg",
    card_storage_path: null,
  });
  assert.equal(resolved, "https://legacy.example.com/original.jpg");
});

void test("resolvePropertyImageUrl returns null when no image source exists", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  const resolved = resolvePropertyImageUrl({ image_url: null, card_storage_path: null });
  assert.equal(resolved, null);
});

void test("resolveSupabasePublicUrlFromPath ignores malformed and external paths", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  assert.equal(resolveSupabasePublicUrlFromPath(""), null);
  assert.equal(
    resolveSupabasePublicUrlFromPath("https://cdn.example.com/test.jpg"),
    "https://cdn.example.com/test.jpg"
  );
});
