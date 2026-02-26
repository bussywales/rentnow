import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCollectionShareMetadata,
  buildStaticCollectionMetadata,
  resolveCollectionShareId,
} from "@/app/collections/[shareId]/page";

void test("collection metadata includes collection title and image when available", () => {
  const metadata = buildCollectionShareMetadata({
    shareId: "aee2f2f8-5f3e-49b7-bf9d-9f8a511559d4",
    baseUrl: "https://www.propatyhub.com",
    title: "Abuja Friday Shortlist",
    city: "Abuja",
    imageUrl: "https://images.propatyhub.com/cover.jpg",
  });

  assert.equal(metadata.title, "Abuja Friday Shortlist · PropatyHub");
  assert.equal(metadata.description, "Shared shortlist of homes in Abuja on PropatyHub.");
  assert.equal(
    metadata.alternates?.canonical,
    "https://www.propatyhub.com/collections/aee2f2f8-5f3e-49b7-bf9d-9f8a511559d4"
  );
  assert.equal(metadata.openGraph?.images?.[0]?.url, "https://images.propatyhub.com/cover.jpg");
});

void test("static collections metadata resolves canonical and OG urls from base URL", () => {
  const metadata = buildStaticCollectionMetadata({
    slug: "weekend-getaways",
    title: "Weekend getaways",
    description: "Shortlet picks for quick city breaks and flexible weekend plans.",
    baseUrl: "https://www.propatyhub.com",
  });

  assert.equal(metadata.title, "Weekend getaways · PropatyHub");
  assert.match(String(metadata.description), /Share this market-aware collection on PropatyHub\./);
  assert.equal(
    metadata.alternates?.canonical,
    "https://www.propatyhub.com/collections/weekend-getaways"
  );
  assert.equal(
    metadata.openGraph?.images?.[0]?.url,
    "https://www.propatyhub.com/og-propatyhub.png"
  );
  assert.equal(metadata.twitter?.images?.[0], "https://www.propatyhub.com/og-propatyhub.png");
});

void test("collection share id resolution prefers static slugs, then UUIDs, then invalid", () => {
  const staticSlug = resolveCollectionShareId("weekend-getaways");
  assert.equal(staticSlug.kind, "slug");
  assert.equal(staticSlug.kind === "slug" ? staticSlug.collection.slug : null, "weekend-getaways");

  const uuid = resolveCollectionShareId("aee2f2f8-5f3e-49b7-bf9d-9f8a511559d4");
  assert.equal(uuid.kind, "uuid");

  const uuidLikeSlug = resolveCollectionShareId(
    "weekend-getaways-123e4567-e89b-12d3-a456-426614174000"
  );
  assert.equal(uuidLikeSlug.kind, "invalid");
});
