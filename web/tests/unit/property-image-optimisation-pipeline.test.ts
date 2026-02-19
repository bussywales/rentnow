import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processPropertyImageUpload } from "@/lib/properties/image-optimisation.server";

void test("image optimisation pipeline uploads original + derivatives and persists storage paths", async () => {
  const sourceBuffer = await sharp({
    create: {
      width: 1800,
      height: 1200,
      channels: 3,
      background: { r: 220, g: 230, b: 240 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const uploads: Array<{ path: string; contentType: string; bytes: number }> = [];
  let persistedRow: Record<string, unknown> | null = null;

  const result = await processPropertyImageUpload({
    propertyId: "prop-123",
    fileBuffer: sourceBuffer,
    fileName: "living-room.jpg",
    contentType: "image/jpeg",
    imageId: "img-abc",
    getPublicUrl: (path) => `https://cdn.example.com/${path}`,
    uploadObject: async ({ path, body, contentType }) => {
      uploads.push({ path, contentType, bytes: body.byteLength });
    },
    getNextPosition: async () => 4,
    upsertImageRow: async (row) => {
      persistedRow = row;
      return {
        id: row.id,
        image_url: row.image_url,
        position: row.position,
        width: row.width,
        height: row.height,
        bytes: row.bytes,
        format: row.format,
        storage_path: row.storage_path,
        original_storage_path: row.original_storage_path,
        thumb_storage_path: row.thumb_storage_path,
        card_storage_path: row.card_storage_path,
        hero_storage_path: row.hero_storage_path,
      };
    },
  });

  assert.equal(uploads.length, 4, "expected original + thumb/card/hero uploads");
  assert.equal(
    uploads.some((upload) => upload.path.endsWith("/original.jpg")),
    true,
    "original file path should be persisted"
  );
  assert.equal(
    uploads.some((upload) => upload.path.endsWith("/card.webp")),
    true,
    "card derivative should be uploaded"
  );
  assert.ok(persistedRow, "expected DB row payload to be generated");
  assert.equal(String((persistedRow as { property_id?: string }).property_id), "prop-123");
  assert.equal(result.image.id, "img-abc");
  assert.equal(result.image.position, 4);
  assert.equal(result.image.card_storage_path.endsWith("/card.webp"), true);
  assert.equal(result.derivatives.cardUrl.endsWith("/card.webp"), true);
  assert.equal(result.warning, null);
});
