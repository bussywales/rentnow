import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import { postSavedToggleResponse, type SavedToggleDeps } from "@/app/api/saved/toggle/route";

function createSavedPropertiesSupabaseStub() {
  let upsertCount = 0;
  let deleteCount = 0;
  let deletedListingId: string | null = null;

  const supabase = {
    from: (table: string) => {
      assert.equal(table, "saved_properties");
      return {
        upsert: async (payload: { user_id?: string; property_id?: string }) => {
          upsertCount += 1;
          assert.equal(payload.user_id, "user-1");
          return { error: null };
        },
        delete: () => ({
          eq: (_column: string, _value: string) => ({
            eq: (column: string, value: string) => {
              if (column === "property_id") deletedListingId = value;
              deleteCount += 1;
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };
    },
  };

  return {
    supabase,
    getUpsertCount: () => upsertCount,
    getDeleteCount: () => deleteCount,
    getDeletedListingId: () => deletedListingId,
  };
}

void test("saved toggle route writes saved_properties upsert when saved=true", async () => {
  const stub = createSavedPropertiesSupabaseStub();
  const deps: SavedToggleDeps = {
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "user-1" },
        supabase: stub.supabase,
      }) as Awaited<ReturnType<SavedToggleDeps["requireUser"]>>,
    toggleListingInDefaultCollection: async () => ({ saved: true, collectionId: "default-1" }),
    setListingInDefaultCollection: async () => ({ saved: true, collectionId: "default-1" }),
  };

  const response = await postSavedToggleResponse(
    new Request("http://localhost/api/saved/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: "listing-1", desiredSaved: true }),
    }),
    deps
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.saved, true);
  assert.equal(stub.getUpsertCount(), 1);
  assert.equal(stub.getDeleteCount(), 0);
});

void test("saved toggle route writes saved_properties delete when saved=false", async () => {
  const stub = createSavedPropertiesSupabaseStub();
  const deps: SavedToggleDeps = {
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "user-1" },
        supabase: stub.supabase,
      }) as Awaited<ReturnType<SavedToggleDeps["requireUser"]>>,
    toggleListingInDefaultCollection: async () => ({ saved: false, collectionId: "default-1" }),
    setListingInDefaultCollection: async () => ({ saved: false, collectionId: "default-1" }),
  };

  const response = await postSavedToggleResponse(
    new Request("http://localhost/api/saved/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: "listing-2", desiredSaved: false }),
    }),
    deps
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.saved, false);
  assert.equal(stub.getUpsertCount(), 0);
  assert.equal(stub.getDeleteCount(), 1);
  assert.equal(stub.getDeletedListingId(), "listing-2");
});

void test("saved toggle route returns auth response when unauthorized", async () => {
  const deps: SavedToggleDeps = {
    requireUser: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<SavedToggleDeps["requireUser"]>>,
    toggleListingInDefaultCollection: async () => ({ saved: false, collectionId: "default-1" }),
    setListingInDefaultCollection: async () => ({ saved: false, collectionId: "default-1" }),
  };

  const response = await postSavedToggleResponse(
    new Request("http://localhost/api/saved/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: "listing-2" }),
    }),
    deps
  );

  assert.equal(response.status, 401);
});
