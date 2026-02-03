import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import {
  deleteSavedPropertiesResponse,
  getSavedPropertiesResponse,
  postSavedPropertiesResponse,
  type SavedPropertiesDeps,
} from "@/app/api/saved-properties/route";

type SupabaseStub = {
  from: (table: string) => unknown;
};

function createSupabaseStub(options: {
  propertyExists?: boolean;
  savedRows?: Array<{ id: string; property_id: string }>;
}) {
  const propertyExists = options.propertyExists ?? true;
  const savedRows = options.savedRows ?? [{ id: "save-1", property_id: "prop-1" }];
  const supabase: SupabaseStub = {
    from: (table: string) => {
      if (table === "properties") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: propertyExists ? { id: "prop-1" } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "saved_properties") {
        return {
          select: () => ({
            eq: async () => ({ data: savedRows, error: null }),
          }),
          upsert: async () => ({ error: null }),
          delete: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return supabase;
}

const baseDeps: SavedPropertiesDeps = {
  hasServerSupabaseEnv: () => true,
  requireUser: async () => ({
    ok: true,
    user: { id: "user-1" },
    supabase: createSupabaseStub({}),
  }),
  logFailure: () => undefined,
};

void test("saved properties GET returns saved list", async () => {
  const res = await getSavedPropertiesResponse(
    new Request("http://localhost/api/saved-properties"),
    baseDeps
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.saved));
});

void test("saved properties POST requires auth", async () => {
  const res = await postSavedPropertiesResponse(
    new Request("http://localhost/api/saved-properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: "prop-1" }),
    }),
    {
      ...baseDeps,
      requireUser: async () =>
        ({
          ok: false,
          response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        }) as Awaited<ReturnType<SavedPropertiesDeps["requireUser"]>>,
    }
  );
  assert.equal(res.status, 401);
});

void test("saved properties POST saves when valid", async () => {
  const supabase = createSupabaseStub({ propertyExists: true });
  const res = await postSavedPropertiesResponse(
    new Request("http://localhost/api/saved-properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: "prop-1" }),
    }),
    {
      ...baseDeps,
      requireUser: async () =>
        ({
          ok: true,
          user: { id: "user-1" },
          supabase,
        }) as Awaited<ReturnType<SavedPropertiesDeps["requireUser"]>>,
    }
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

void test("saved properties DELETE requires property_id", async () => {
  const res = await deleteSavedPropertiesResponse(
    new Request("http://localhost/api/saved-properties", { method: "DELETE" }),
    baseDeps
  );
  assert.equal(res.status, 400);
});
