import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { getListingRemovalDependencySummary } from "@/lib/admin/listing-removal.server";
import {
  buildAdminBulkListingPreflight,
  deactivateListingForAdmin,
  formatBulkPurgeConfirmation,
  purgeListingForAdmin,
  type AdminBulkListingAction,
  type AdminListingLifecycleRow,
} from "@/lib/admin/admin-listing-lifecycle.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/listings/bulk";
const MAX_BULK_SELECTION = 100;

const bodySchema = z.object({
  action: z.enum(["deactivate", "purge"]),
  mode: z.enum(["preflight", "execute"]).default("preflight"),
  ids: z.array(z.string().uuid()).min(1).max(MAX_BULK_SELECTION),
  reason: z.string().trim().min(8).max(500).optional(),
  confirmationText: z.string().trim().optional().nullable(),
});

export type AdminBulkListingsRouteDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logFailure: typeof logFailure;
  getListingRemovalDependencySummary: typeof getListingRemovalDependencySummary;
};

const defaultDeps: AdminBulkListingsRouteDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
  logFailure,
  getListingRemovalDependencySummary,
};

async function loadListings(client: SupabaseClient, ids: string[]) {
  const result = await client
    .from("properties")
    .select("id,title,status,is_active,is_approved,is_featured")
    .in("id", ids);

  if (result.error) {
    throw new Error(result.error.message || "Unable to load selected listings.");
  }

  return ((result.data as AdminListingLifecycleRow[] | null) ?? []).sort(
    (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
  );
}

async function buildPreflight({
  client,
  action,
  ids,
  getListingRemovalDependencySummary,
}: {
  client: SupabaseClient;
  action: AdminBulkListingAction;
  ids: string[];
  getListingRemovalDependencySummary: typeof defaultDeps.getListingRemovalDependencySummary;
}) {
  const listings = await loadListings(client, ids);
  const dependencyEntries = await Promise.all(
    listings.map(async (listing) => {
      const summary = await getListingRemovalDependencySummary({
        client,
        listingId: listing.id,
      });
      return [listing.id, summary] as const;
    })
  );

  return buildAdminBulkListingPreflight({
    action,
    selectedIds: ids,
    listings,
    dependencySummaryById: Object.fromEntries(dependencyEntries),
  });
}

export async function postAdminListingsBulkLifecycleResponse(
  request: NextRequest,
  deps: AdminBulkListingsRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Invalid payload"
        : error instanceof Error
          ? error.message
          : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const ids = Array.from(new Set(parsed.ids));
  const client = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : auth.supabase;

  let preflight;
  try {
    preflight = await buildPreflight({
      client,
      action: parsed.action,
      ids,
      getListingRemovalDependencySummary: deps.getListingRemovalDependencySummary,
    });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load bulk cleanup preflight." },
      { status: 500 }
    );
  }

  if (parsed.mode === "preflight") {
    return NextResponse.json({ ok: true, preflight });
  }

  if (!parsed.reason) {
    return NextResponse.json({ error: "Admin reason is required." }, { status: 422 });
  }

  if (parsed.action === "purge") {
    const requiredConfirmation = preflight.requiredConfirmationText ?? formatBulkPurgeConfirmation(0);
    if (parsed.confirmationText !== requiredConfirmation) {
      return NextResponse.json(
        {
          error: `Type ${requiredConfirmation} to confirm permanent deletion.`,
          preflight,
        },
        { status: 422 }
      );
    }
  }

  const eligibleItems = preflight.items.filter((item) => item.eligibility === "eligible");
  if (!eligibleItems.length) {
    return NextResponse.json(
      {
        error:
          parsed.action === "deactivate"
            ? "No selected listings are eligible for bulk deactivate."
            : "No selected listings are eligible for permanent delete.",
        preflight,
      },
      { status: 409 }
    );
  }

  const listings = await loadListings(client, eligibleItems.map((item) => item.id));
  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));
  const affectedIds: string[] = [];
  let totalShareLinksRevoked = 0;

  for (const item of eligibleItems) {
    const listing = listingMap.get(item.id);
    if (!listing || !item.dependencySummary) continue;

    if (parsed.action === "deactivate") {
      const result = await deactivateListingForAdmin({
        client,
        listing,
        actorId: auth.user.id,
        reason: parsed.reason,
        dependencySummary: item.dependencySummary,
      });
      affectedIds.push(result.id);
      totalShareLinksRevoked += result.shareLinksRevoked;
      continue;
    }

    await purgeListingForAdmin({
      client,
      listing,
      actorId: auth.user.id,
      reason: parsed.reason,
      dependencySummary: item.dependencySummary,
    });
    affectedIds.push(item.id);
  }

  const blockedItems = preflight.items.filter((item) => item.eligibility !== "eligible");

  try {
    await client.from("admin_actions_log").insert({
      property_id: null,
      action_type: parsed.action === "deactivate" ? "bulk_remove_marketplace" : "bulk_purge_listing",
      actor_id: auth.user.id,
      payload_json: {
        reason: parsed.reason,
        selected_count: preflight.selectedCount,
        affected_count: affectedIds.length,
        blocked_count: blockedItems.length,
        affected_listing_ids: affectedIds,
        blocked_items: blockedItems.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          eligibility: item.eligibility,
        })),
        required_confirmation_text: preflight.requiredConfirmationText,
        share_links_revoked: parsed.action === "deactivate" ? totalShareLinksRevoked : 0,
      },
    });
  } catch {
    // ignore audit insert failure
  }

  return NextResponse.json({
    ok: true,
    action: parsed.action,
    affectedIds,
    affectedCount: affectedIds.length,
    blockedCount: blockedItems.length,
    blockedItems,
    shareLinksRevoked: totalShareLinksRevoked,
    preflight,
  });
}

export async function POST(request: NextRequest) {
  return postAdminListingsBulkLifecycleResponse(request);
}
