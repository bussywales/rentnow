import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  patchAdminListingLifecycleResponse,
  type AdminListingLifecycleDeps,
} from "@/app/api/admin/listings/[id]/route";

const makeRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/listings/prop-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const emptySummary = {
  protected: [],
  cleanup: [],
  protectedCount: 0,
  cleanupCount: 0,
  errors: [],
  canPurge: true,
};

type ListingRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  is_featured?: boolean | null;
};

function buildSupabaseStub(options: {
  listing: ListingRow | null;
  revokedLinks?: Array<{ id: string }>;
  capture: {
    propertyUpdate: Record<string, unknown> | null;
    deletedId: string | null;
    loggedAction: Record<string, unknown> | null;
  };
}) {
  const revokedLinks = options.revokedLinks ?? [];
  return {
    from: (table: string) => {
      if (table === "properties") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: options.listing, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            options.capture.propertyUpdate = payload;
            return {
              eq: async () => ({ error: null }),
            };
          },
          delete: () => ({
            eq: async (_column: string, id: string) => {
              options.capture.deletedId = id;
              return { error: null };
            },
          }),
        };
      }

      if (table === "property_share_links") {
        return {
          update: () => ({
            eq: () => ({
              is: () => ({
                select: async () => ({ data: revokedLinks, error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "admin_actions_log") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            options.capture.loggedAction = payload;
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

void test("admin can remove a listing from the marketplace", async () => {
  const capture = {
    propertyUpdate: null as Record<string, unknown> | null,
    deletedId: null as string | null,
    loggedAction: null as Record<string, unknown> | null,
  };
  const supabase = buildSupabaseStub({
    listing: { id: "prop-1", title: "Listing", status: "live", is_active: true, is_approved: true, is_featured: true },
    revokedLinks: [{ id: "share-1" }],
    capture,
  }) as ReturnType<AdminListingLifecycleDeps["createServerSupabaseClient"]>;

  const deps: AdminListingLifecycleDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => ({} as ReturnType<AdminListingLifecycleDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminListingLifecycleDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async () => ({
      ...emptySummary,
      cleanup: [{ key: "property_share_links", label: "Property share links", count: 1 }],
      cleanupCount: 1,
    }),
  };

  const response = await patchAdminListingLifecycleResponse(
    makeRequest({ action: "deactivate", reason: "Duplicate listing removed by ops." }),
    "prop-1",
    deps
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.status, "removed");
  assert.equal(json.shareLinksRevoked, 1);
  assert.equal(capture.propertyUpdate?.status, "removed");
  assert.equal(capture.propertyUpdate?.is_active, false);
  assert.equal(capture.propertyUpdate?.is_approved, false);
  assert.equal(capture.propertyUpdate?.is_featured, false);
  assert.equal(capture.loggedAction?.action_type, "remove_marketplace");
});

void test("permanent delete requires removed status first", async () => {
  const capture = {
    propertyUpdate: null as Record<string, unknown> | null,
    deletedId: null as string | null,
    loggedAction: null as Record<string, unknown> | null,
  };
  const supabase = buildSupabaseStub({
    listing: { id: "prop-1", title: "Listing", status: "live" },
    capture,
  }) as ReturnType<AdminListingLifecycleDeps["createServerSupabaseClient"]>;

  const deps: AdminListingLifecycleDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => ({} as ReturnType<AdminListingLifecycleDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminListingLifecycleDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async () => emptySummary,
  };

  const response = await patchAdminListingLifecycleResponse(
    makeRequest({ action: "purge", reason: "Clean up test data.", confirmationText: "DELETE" }),
    "prop-1",
    deps
  );

  assert.equal(response.status, 409);
  const json = await response.json();
  assert.equal(json.code, "REMOVE_FIRST");
  assert.equal(capture.deletedId, null);
});

void test("permanent delete is blocked when protected history exists", async () => {
  const capture = {
    propertyUpdate: null as Record<string, unknown> | null,
    deletedId: null as string | null,
    loggedAction: null as Record<string, unknown> | null,
  };
  const supabase = buildSupabaseStub({
    listing: { id: "prop-1", title: "Listing", status: "removed" },
    capture,
  }) as ReturnType<AdminListingLifecycleDeps["createServerSupabaseClient"]>;

  const deps: AdminListingLifecycleDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => ({} as ReturnType<AdminListingLifecycleDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminListingLifecycleDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async () => ({
      ...emptySummary,
      protected: [{ key: "shortlet_bookings", label: "Shortlet bookings", count: 2 }],
      protectedCount: 2,
      canPurge: false,
    }),
  };

  const response = await patchAdminListingLifecycleResponse(
    makeRequest({ action: "purge", reason: "Need to wipe this listing.", confirmationText: "DELETE" }),
    "prop-1",
    deps
  );

  assert.equal(response.status, 409);
  const json = await response.json();
  assert.equal(json.code, "PURGE_BLOCKED");
  assert.equal(capture.deletedId, null);
});

void test("admin can permanently delete a removed listing with no protected history", async () => {
  const capture = {
    propertyUpdate: null as Record<string, unknown> | null,
    deletedId: null as string | null,
    loggedAction: null as Record<string, unknown> | null,
  };
  const supabase = buildSupabaseStub({
    listing: { id: "prop-1", title: "Listing", status: "removed" },
    capture,
  }) as ReturnType<AdminListingLifecycleDeps["createServerSupabaseClient"]>;

  const deps: AdminListingLifecycleDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => ({} as ReturnType<AdminListingLifecycleDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminListingLifecycleDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async () => ({
      ...emptySummary,
      cleanup: [{ key: "property_images", label: "Listing images", count: 3 }],
      cleanupCount: 3,
    }),
  };

  const response = await patchAdminListingLifecycleResponse(
    makeRequest({ action: "purge", reason: "Legal removal completed.", confirmationText: "DELETE" }),
    "prop-1",
    deps
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.action, "purge");
  assert.equal(capture.deletedId, "prop-1");
  assert.equal(capture.loggedAction?.property_id, null);
  assert.equal(capture.loggedAction?.action_type, "purge_listing");
  assert.deepEqual(capture.loggedAction?.payload_json, {
    reason: "Legal removal completed.",
    purged_property_id: "prop-1",
    prior_status: "removed",
    title: "Listing",
    protected_dependency_count: 0,
    cleanup_dependency_count: 3,
  });
});

void test("purge requires typed confirmation", async () => {
  const supabase = {} as ReturnType<AdminListingLifecycleDeps["createServerSupabaseClient"]>;
  const deps: AdminListingLifecycleDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminListingLifecycleDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminListingLifecycleDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async () => emptySummary,
  };

  const response = await patchAdminListingLifecycleResponse(
    makeRequest({ action: "purge", reason: "Legal removal completed.", confirmationText: "nope" }),
    "prop-1",
    deps
  );

  assert.equal(response.status, 422);
});
