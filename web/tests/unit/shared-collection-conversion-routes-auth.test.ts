import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import {
  postSavedCollectionImportResponse,
  type ImportSharedCollectionDeps,
} from "@/app/api/saved/collections/import/route";
import {
  postSavedSearchFromCollectionResponse,
  type SavedSearchFromCollectionDeps,
} from "@/app/api/saved-searches/from-collection/route";

const deniedRequireUser = async () =>
  ({ ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }) as const;

void test("POST /api/saved/collections/import requires authentication", async () => {
  const deps: ImportSharedCollectionDeps = {
    requireUser: deniedRequireUser as never,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: (() => ({})) as never,
    importSharedCollectionForOwner: (async () => ({
      shareTitle: "Shared",
      collectionId: "collection-1",
      collection: null,
      importedListingIds: ["listing-1"],
    })) as never,
  };

  const response = await postSavedCollectionImportResponse(
    new Request("http://localhost/api/saved/collections/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId: "6e66b070-9dff-4f4b-a013-a74ae8dd4fd6" }),
    }),
    deps
  );

  assert.equal(response.status, 401);
});

void test("POST /api/saved-searches/from-collection requires authentication", async () => {
  const deps: SavedSearchFromCollectionDeps = {
    requireUser: deniedRequireUser as never,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: (() => ({})) as never,
    getPublicCollectionByShareId: (async () => null) as never,
  };

  const response = await postSavedSearchFromCollectionResponse(
    new Request("http://localhost/api/saved-searches/from-collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId: "6e66b070-9dff-4f4b-a013-a74ae8dd4fd6" }),
    }),
    deps
  );

  assert.equal(response.status, 401);
});
