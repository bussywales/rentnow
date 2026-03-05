import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAdminReviewMedia } from "@/lib/admin/admin-review-media";

void test("normalizeAdminReviewMedia resolves storage-path-backed image URLs", () => {
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    const result = normalizeAdminReviewMedia({
      coverImageUrl: null,
      images: [
        {
          id: "img-1",
          image_url: null,
          card_storage_path: "properties/p1/i1/card.webp",
          width: 1200,
          height: 900,
        },
      ],
    });

    assert.equal(
      result.images[0]?.image_url,
      "https://example.supabase.co/storage/v1/object/public/property-images/properties/p1/i1/card.webp"
    );
    assert.equal(
      result.coverImageUrl,
      "https://example.supabase.co/storage/v1/object/public/property-images/properties/p1/i1/card.webp"
    );
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
  }
});

void test("normalizeAdminReviewMedia prioritizes cover image ordering", () => {
  const result = normalizeAdminReviewMedia({
    coverImageUrl: "https://cdn.example.com/cover.jpg",
    images: [
      {
        id: "img-1",
        image_url: "https://cdn.example.com/a.jpg",
        created_at: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "img-2",
        image_url: "https://cdn.example.com/cover.jpg",
        created_at: "2026-03-02T00:00:00.000Z",
      },
    ],
  });

  assert.equal(result.images[0]?.id, "img-2");
  assert.equal(result.coverImageUrl, "https://cdn.example.com/cover.jpg");
});
