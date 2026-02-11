import test from "node:test";
import assert from "node:assert/strict";
import { buildCollectionShareMetadata } from "@/app/collections/[shareId]/page";

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
