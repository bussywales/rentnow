import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postAdminProductUpdatesSyncResponse,
  type ProductUpdatesSyncRouteDeps,
} from "@/app/api/admin/product-updates/sync/route";

function makeRequest(secret?: string) {
  return new NextRequest("http://localhost/api/admin/product-updates/sync", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : undefined,
  });
}

void test("product updates sync route blocks non-admin without cron secret", async () => {
  const deps: ProductUpdatesSyncRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getCronSecret: () => "cron-secret",
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<ProductUpdatesSyncRouteDeps["requireRole"]>>,
    syncProductUpdateDraftsFromDocs: async () => {
      throw new Error("should not be called");
    },
  };

  const response = await postAdminProductUpdatesSyncResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("product updates sync route accepts valid cron secret", async () => {
  let roleChecks = 0;
  let actorId: string | null | undefined;

  const deps: ProductUpdatesSyncRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getCronSecret: () => "cron-secret",
    requireRole: async () => {
      roleChecks += 1;
      return {
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      } as Awaited<ReturnType<ProductUpdatesSyncRouteDeps["requireRole"]>>;
    },
    syncProductUpdateDraftsFromDocs: async (input) => {
      actorId = input.actorId;
      return {
        created: 1,
        updated: 2,
        unchanged: 3,
        skippedInvalid: 0,
        processedNotes: 2,
        invalidNotes: [],
      };
    },
  };

  const response = await postAdminProductUpdatesSyncResponse(makeRequest("cron-secret"), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.created, 1);
  assert.equal(roleChecks, 0);
  assert.equal(actorId, null);
});

void test("product updates sync route uses admin actor id for admin session", async () => {
  let actorId: string | null | undefined;

  const deps: ProductUpdatesSyncRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () => ({}) as never,
    getCronSecret: () => "",
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<ProductUpdatesSyncRouteDeps["requireRole"]>>,
    syncProductUpdateDraftsFromDocs: async (input) => {
      actorId = input.actorId;
      return {
        created: 0,
        updated: 0,
        unchanged: 1,
        skippedInvalid: 0,
        processedNotes: 1,
        invalidNotes: [],
      };
    },
  };

  const response = await postAdminProductUpdatesSyncResponse(makeRequest(), deps);
  assert.equal(response.status, 200);
  assert.equal(actorId, "admin-1");
});
