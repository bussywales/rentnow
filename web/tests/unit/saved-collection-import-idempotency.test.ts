import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportedCollectionTitle,
  findImportedCollectionIdMatch,
  uniqueSortedListingIds,
} from "@/lib/saved-collections.server";

void test("uniqueSortedListingIds normalizes duplicates deterministically", () => {
  const normalized = uniqueSortedListingIds(["b", "a", "b", "", "c"]);
  assert.deepEqual(normalized, ["a", "b", "c"]);
});

void test("findImportedCollectionIdMatch returns existing collection for same listing set", () => {
  const target = uniqueSortedListingIds(["listing-3", "listing-1", "listing-2"]);
  const match = findImportedCollectionIdMatch({
    targetListingIds: target,
    candidates: [
      { collectionId: "c1", listingIds: uniqueSortedListingIds(["listing-1", "listing-2"]) },
      { collectionId: "c2", listingIds: uniqueSortedListingIds(["listing-2", "listing-3", "listing-1"]) },
    ],
  });

  assert.equal(match, "c2");
});

void test("buildImportedCollectionTitle creates stable title prefix", () => {
  assert.equal(buildImportedCollectionTitle("Abuja Friday"), "Shortlist from Abuja Friday");
  assert.equal(buildImportedCollectionTitle(""), "Shared shortlist");
});
