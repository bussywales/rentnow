import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { getListingRemovalDependencySummary } from "@/lib/admin/listing-removal.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/listings/[id]";
const PURGE_CONFIRMATION = "DELETE";

const bodySchema = z
  .object({
    action: z.enum(["deactivate", "purge"]),
    reason: z.string().trim().min(8).max(500),
    confirmationText: z.string().trim().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "purge" && value.confirmationText !== PURGE_CONFIRMATION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmationText"],
        message: `Type ${PURGE_CONFIRMATION} to confirm permanent deletion.`,
      });
    }
  });

export type AdminListingLifecycleDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logFailure: typeof logFailure;
  getListingRemovalDependencySummary: typeof getListingRemovalDependencySummary;
};

const defaultDeps: AdminListingLifecycleDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
  logFailure,
  getListingRemovalDependencySummary,
};

export async function patchAdminListingLifecycleResponse(
  request: NextRequest,
  listingId: string,
  deps: AdminListingLifecycleDeps = defaultDeps
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

  const client = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : auth.supabase;

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

  const { data: listing, error: listingError } = await client
    .from("properties")
    .select("id,title,status,is_active,is_approved,is_featured")
    .eq("id", listingId)
    .maybeSingle<{
      id: string;
      title: string | null;
      status: string | null;
      is_active: boolean | null;
      is_approved: boolean | null;
      is_featured: boolean | null;
    }>();

  if (listingError || !listing) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: listingError || "Listing not found",
    });
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const dependencySummary = await deps.getListingRemovalDependencySummary({
    client,
    listingId,
  });

  const nowIso = new Date().toISOString();

  if (parsed.action === "deactivate") {
    const updates: Record<string, unknown> = {
      status: "removed",
      is_active: false,
      is_approved: false,
      is_featured: false,
      featured_rank: null,
      featured_until: null,
      rejection_reason: null,
      paused_reason: null,
      paused_at: null,
      status_updated_at: nowIso,
      updated_at: nowIso,
    };

    const { error: updateError } = await client.from("properties").update(updates).eq("id", listingId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const revokeResult = await client
      .from("property_share_links")
      .update({ revoked_at: nowIso })
      .eq("property_id", listingId)
      .is("revoked_at", null)
      .select("id");

    if (revokeResult.error) {
      return NextResponse.json({ error: revokeResult.error.message }, { status: 400 });
    }

    try {
      await client.from("admin_actions_log").insert({
        property_id: listingId,
        action_type: "remove_marketplace",
        actor_id: auth.user.id,
        payload_json: {
          reason: parsed.reason,
          prior_status: listing.status,
          share_links_revoked: revokeResult.data?.length ?? 0,
          protected_dependency_count: dependencySummary.protectedCount,
        },
      });
    } catch {
      // ignore audit insert failure
    }

    return NextResponse.json({
      ok: true,
      action: "deactivate",
      id: listingId,
      status: "removed",
      shareLinksRevoked: revokeResult.data?.length ?? 0,
      dependencySummary,
    });
  }

  if ((listing.status ?? "").toLowerCase() !== "removed") {
    return NextResponse.json(
      {
        error: "Deactivate the listing first before permanent deletion.",
        code: "REMOVE_FIRST",
        dependencySummary,
      },
      { status: 409 }
    );
  }

  if (!dependencySummary.canPurge) {
    return NextResponse.json(
      {
        error:
          dependencySummary.errors.length > 0
            ? "Dependency audit failed. Resolve the audit errors before permanent deletion."
            : "Permanent delete is blocked because protected history still exists.",
        code: dependencySummary.errors.length > 0 ? "DEPENDENCY_AUDIT_FAILED" : "PURGE_BLOCKED",
        dependencySummary,
      },
      { status: 409 }
    );
  }

  const { error: deleteError } = await client.from("properties").delete().eq("id", listingId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  try {
    await client.from("admin_actions_log").insert({
      property_id: null,
      action_type: "purge_listing",
      actor_id: auth.user.id,
      payload_json: {
        reason: parsed.reason,
        purged_property_id: listingId,
        prior_status: listing.status,
        title: listing.title ?? null,
        protected_dependency_count: dependencySummary.protectedCount,
        cleanup_dependency_count: dependencySummary.cleanupCount,
      },
    });
  } catch {
    // ignore audit insert failure
  }

  return NextResponse.json({
    ok: true,
    action: "purge",
    id: listingId,
    title: listing.title ?? null,
    dependencySummary,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return patchAdminListingLifecycleResponse(request, id);
}
