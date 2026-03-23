import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postAdminListingsBulkLifecycleResponse,
  type AdminBulkListingsRouteDeps,
} from "@/app/api/admin/listings/bulk/route";
import type { AdminListingLifecycleRow } from "@/lib/admin/admin-listing-lifecycle.server";
import type { ListingRemovalDependencySummary } from "@/lib/admin/listing-removal.server";

const PREVIEW_ELIGIBLE_ID = "11111111-1111-4111-8111-111111111111";
const PREVIEW_REQUIRES_DEACTIVATE_ID = "22222222-2222-4222-8222-222222222222";
const PREVIEW_PROTECTED_ID = "33333333-3333-4333-8333-333333333333";
const DEACTIVATE_ELIGIBLE_ID = "44444444-4444-4444-8444-444444444444";
const DEACTIVATE_ALREADY_REMOVED_ID = "55555555-5555-4555-8555-555555555555";
const PURGE_CONFIRMATION_ID = "66666666-6666-4666-8666-666666666666";
const PURGE_ELIGIBLE_ID = "77777777-7777-4777-8777-777777777777";
const PURGE_BLOCKED_ID = "88888888-8888-4888-8888-888888888888";
const PURGE_LIVE_ID = "99999999-9999-4999-8999-999999999999";

const makeRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/listings/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const emptySummary: ListingRemovalDependencySummary = {
  protected: [],
  cleanup: [],
  protectedCount: 0,
  cleanupCount: 0,
  errors: [],
  canPurge: true,
};

type Capture = {
  propertyUpdates: Array<{ id: string; payload: Record<string, unknown> }>;
  deletedIds: string[];
  auditEntries: Array<Record<string, unknown>>;
};

function buildSupabaseStub(options: {
  listings: AdminListingLifecycleRow[];
  shareLinkCounts?: Record<string, number>;
  capture: Capture;
}) {
  const listings = options.listings;
  const shareLinkCounts = options.shareLinkCounts ?? {};
  return {
    from: (table: string) => {
      if (table === "properties") {
        return {
          select: () => ({
            in: async (_column: string, ids: string[]) => ({
              data: listings.filter((listing) => ids.includes(listing.id)),
              error: null,
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async (_column: string, id: string) => {
              options.capture.propertyUpdates.push({ id, payload });
              return { error: null };
            },
          }),
          delete: () => ({
            eq: async (_column: string, id: string) => {
              options.capture.deletedIds.push(id);
              return { error: null };
            },
          }),
        };
      }

      if (table === "property_share_links") {
        return {
          update: () => ({
            eq: (_column: string, id: string) => ({
              is: () => ({
                select: async () => ({
                  data: Array.from({ length: shareLinkCounts[id] ?? 0 }, (_, index) => ({
                    id: `${id}-share-${index + 1}`,
                  })),
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "admin_actions_log") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            options.capture.auditEntries.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

void test("bulk purge preflight separates eligible rows, blockers, and recommended deactivate rows", async () => {
  const capture: Capture = { propertyUpdates: [], deletedIds: [], auditEntries: [] };
  const supabase = buildSupabaseStub({
    listings: [
      { id: PREVIEW_ELIGIBLE_ID, title: "Demo 1", status: "removed", is_active: false, is_approved: false, is_featured: false },
      { id: PREVIEW_REQUIRES_DEACTIVATE_ID, title: "Demo 2", status: "live", is_active: true, is_approved: true, is_featured: false },
      { id: PREVIEW_PROTECTED_ID, title: "Demo 3", status: "removed", is_active: false, is_approved: false, is_featured: false },
    ],
    capture,
  }) as ReturnType<AdminBulkListingsRouteDeps["createServerSupabaseClient"]>;

  const deps: AdminBulkListingsRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => ({} as ReturnType<AdminBulkListingsRouteDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminBulkListingsRouteDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async ({ listingId }) => {
      if (listingId === PREVIEW_ELIGIBLE_ID) return emptySummary;
      if (listingId === PREVIEW_PROTECTED_ID) {
        return {
          ...emptySummary,
          protected: [{ key: "listing_leads", label: "Listing leads", count: 2 }],
          protectedCount: 2,
          canPurge: false,
        };
      }
      return emptySummary;
    },
  };

  const response = await postAdminListingsBulkLifecycleResponse(
    makeRequest({
      action: "purge",
      mode: "preflight",
      ids: [
        PREVIEW_ELIGIBLE_ID,
        PREVIEW_REQUIRES_DEACTIVATE_ID,
        PREVIEW_PROTECTED_ID,
      ],
    }),
    deps
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.preflight.eligibleCount, 1);
  assert.equal(json.preflight.blockedCount, 2);
  assert.equal(json.preflight.recommendedDeactivateCount, 1);
  assert.equal(json.preflight.requiredConfirmationText, "DELETE 1 LISTINGS");
});

void test("bulk deactivate executes only eligible selected rows and writes a batch audit entry", async () => {
  const capture: Capture = { propertyUpdates: [], deletedIds: [], auditEntries: [] };
  const supabase = buildSupabaseStub({
    listings: [
      { id: DEACTIVATE_ELIGIBLE_ID, title: "Tutorial 1", status: "live", is_active: true, is_approved: true, is_featured: true },
      { id: DEACTIVATE_ALREADY_REMOVED_ID, title: "Tutorial 2", status: "removed", is_active: false, is_approved: false, is_featured: false },
    ],
    shareLinkCounts: {
      [DEACTIVATE_ELIGIBLE_ID]: 2,
    },
    capture,
  }) as ReturnType<AdminBulkListingsRouteDeps["createServerSupabaseClient"]>;

  const deps: AdminBulkListingsRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => ({} as ReturnType<AdminBulkListingsRouteDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminBulkListingsRouteDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async () => emptySummary,
  };

  const response = await postAdminListingsBulkLifecycleResponse(
    makeRequest({
      action: "deactivate",
      mode: "execute",
      ids: [
        DEACTIVATE_ELIGIBLE_ID,
        DEACTIVATE_ALREADY_REMOVED_ID,
      ],
      reason: "Bulk remove tutorial clutter from registry.",
    }),
    deps
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.deepEqual(json.affectedIds, [DEACTIVATE_ELIGIBLE_ID]);
  assert.equal(json.blockedCount, 1);
  assert.equal(capture.propertyUpdates.length, 1);
  assert.equal(capture.propertyUpdates[0]?.id, DEACTIVATE_ELIGIBLE_ID);
  assert.equal(capture.propertyUpdates[0]?.payload.status, "removed");
  assert.ok(
    capture.auditEntries.some((entry) => entry.action_type === "bulk_remove_marketplace"),
    "expected bulk batch audit entry"
  );
});

void test("bulk purge requires typed confirmation derived from eligible delete count", async () => {
  const capture: Capture = { propertyUpdates: [], deletedIds: [], auditEntries: [] };
  const supabase = buildSupabaseStub({
    listings: [
      { id: PURGE_CONFIRMATION_ID, title: "Demo purge", status: "removed", is_active: false, is_approved: false, is_featured: false },
    ],
    capture,
  }) as ReturnType<AdminBulkListingsRouteDeps["createServerSupabaseClient"]>;

  const deps: AdminBulkListingsRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => ({} as ReturnType<AdminBulkListingsRouteDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminBulkListingsRouteDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async () => emptySummary,
  };

  const response = await postAdminListingsBulkLifecycleResponse(
    makeRequest({
      action: "purge",
      mode: "execute",
      ids: [PURGE_CONFIRMATION_ID],
      reason: "Legal purge of safe-only tutorial listing.",
      confirmationText: "DELETE",
    }),
    deps
  );

  assert.equal(response.status, 422);
  const json = await response.json();
  assert.match(json.error, /DELETE 1 LISTINGS/);
  assert.deepEqual(capture.deletedIds, []);
});

void test("bulk purge deletes only eligible rows and leaves blocked rows untouched", async () => {
  const capture: Capture = { propertyUpdates: [], deletedIds: [], auditEntries: [] };
  const supabase = buildSupabaseStub({
    listings: [
      { id: PURGE_ELIGIBLE_ID, title: "Safe purge", status: "removed", is_active: false, is_approved: false, is_featured: false },
      { id: PURGE_BLOCKED_ID, title: "Blocked history", status: "removed", is_active: false, is_approved: false, is_featured: false },
      { id: PURGE_LIVE_ID, title: "Still live", status: "live", is_active: true, is_approved: true, is_featured: false },
    ],
    capture,
  }) as ReturnType<AdminBulkListingsRouteDeps["createServerSupabaseClient"]>;

  const deps: AdminBulkListingsRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => ({} as ReturnType<AdminBulkListingsRouteDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminBulkListingsRouteDeps["requireRole"]>>,
    logFailure: () => undefined,
    getListingRemovalDependencySummary: async ({ listingId }) => {
      if (listingId === PURGE_BLOCKED_ID) {
        return {
          ...emptySummary,
          protected: [{ key: "message_threads", label: "Message threads", count: 4 }],
          protectedCount: 4,
          canPurge: false,
        };
      }
      return emptySummary;
    },
  };

  const response = await postAdminListingsBulkLifecycleResponse(
    makeRequest({
      action: "purge",
      mode: "execute",
      ids: [
        PURGE_ELIGIBLE_ID,
        PURGE_BLOCKED_ID,
        PURGE_LIVE_ID,
      ],
      reason: "Clear safe tutorial clutter from admin listings.",
      confirmationText: "DELETE 1 LISTINGS",
    }),
    deps
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.deepEqual(capture.deletedIds, [PURGE_ELIGIBLE_ID]);
  assert.equal(json.blockedCount, 2);
  assert.ok(
    json.blockedItems.some((item: { id: string; eligibility: string }) => item.id === PURGE_BLOCKED_ID && item.eligibility === "protected_history"),
    "expected protected-history row to stay blocked"
  );
  assert.ok(
    json.blockedItems.some((item: { id: string; eligibility: string }) => item.id === PURGE_LIVE_ID && item.eligibility === "requires_removed_status"),
    "expected live row to require deactivate first"
  );
  assert.ok(
    capture.auditEntries.some((entry) => entry.action_type === "bulk_purge_listing"),
    "expected bulk purge audit entry"
  );
});
