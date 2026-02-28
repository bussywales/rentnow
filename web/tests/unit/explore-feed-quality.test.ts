import test from "node:test";
import assert from "node:assert/strict";
import { mockProperties } from "@/lib/mock";
import { applyExploreImageQualityFilter } from "@/lib/explore/explore-feed.server";
import {
  partitionExploreListingsByImageQuality,
  scoreExploreListingImageQuality,
} from "@/lib/explore/listing-quality";

function buildListingWithImages(id: string, imageUrls: string[]) {
  return {
    ...mockProperties[0],
    id,
    title: `Listing ${id}`,
    cover_image_url: imageUrls[0] ?? null,
    images: imageUrls.map((imageUrl, index) => ({
      id: `${id}-img-${index}`,
      image_url: imageUrl,
      position: index,
    })),
  };
}

void test("scoreExploreListingImageQuality marks empty when no usable image URLs are available", () => {
  const listing = buildListingWithImages("empty", []);
  const score = scoreExploreListingImageQuality(listing);

  assert.equal(score.tier, "empty");
  assert.equal(score.usableImageCount, 0);
});

void test("scoreExploreListingImageQuality marks limited when one usable image exists", () => {
  const listing = buildListingWithImages("limited", ["https://images.unsplash.com/photo-1505691938895-1758d7feb511"]);
  const score = scoreExploreListingImageQuality(listing);

  assert.equal(score.tier, "limited");
  assert.equal(score.usableImageCount, 1);
});

void test("applyExploreImageQualityFilter keeps deterministic order and deprioritises one-image listings", () => {
  const healthyA = buildListingWithImages("healthy-a", [
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511",
    "https://images.unsplash.com/photo-1494526585095-c41746248156",
  ]);
  const empty = buildListingWithImages("empty", []);
  const limited = buildListingWithImages("limited", [
    "https://images.unsplash.com/photo-1430285561322-7808604715df",
  ]);
  const healthyB = buildListingWithImages("healthy-b", [
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858",
  ]);

  const filtered = applyExploreImageQualityFilter([healthyA, empty, limited, healthyB], 3);
  const ids = filtered.map((item) => item.id);

  assert.deepEqual(ids, ["healthy-a", "healthy-b", "limited"]);
});

void test("partitionExploreListingsByImageQuality keeps empty listings out of healthy/limited buckets", () => {
  const healthy = buildListingWithImages("healthy", [
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511",
    "https://images.unsplash.com/photo-1494526585095-c41746248156",
  ]);
  const limited = buildListingWithImages("limited", [
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
  ]);
  const empty = buildListingWithImages("empty", []);

  const partitions = partitionExploreListingsByImageQuality([healthy, limited, empty]);

  assert.deepEqual(
    partitions.healthy.map((item) => item.id),
    ["healthy"]
  );
  assert.deepEqual(
    partitions.limited.map((item) => item.id),
    ["limited"]
  );
  assert.deepEqual(
    partitions.empty.map((item) => item.id),
    ["empty"]
  );
});
