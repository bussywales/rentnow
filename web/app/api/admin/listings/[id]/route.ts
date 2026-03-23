import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { getListingRemovalDependencySummary } from "@/lib/admin/listing-removal.server";
import {
  SINGLE_LISTING_PURGE_CONFIRMATION,
  deactivateListingForAdmin,
  purgeListingForAdmin,
  type AdminListingLifecycleRow,
} from "@/lib/admin/admin-listing-lifecycle.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/listings/[id]";

const bodySchema = z
  .object({
    action: z.enum(["deactivate", "purge"]),
    reason: z.string().trim().min(8).max(500),
    confirmationText: z.string().trim().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "purge" && value.confirmationText !== SINGLE_LISTING_PURGE_CONFIRMATION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmationText"],
        message: `Type ${SINGLE_LISTING_PURGE_CONFIRMATION} to confirm permanent deletion.`,
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
    .maybeSingle<AdminListingLifecycleRow>();

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

  if (parsed.action === "deactivate") {
    try {
      const result = await deactivateListingForAdmin({
        client,
        listing,
        actorId: auth.user.id,
        reason: parsed.reason,
        dependencySummary,
      });

      return NextResponse.json({
        ok: true,
        action: "deactivate",
        id: listingId,
        status: "removed",
        shareLinksRevoked: result.shareLinksRevoked,
        dependencySummary,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to update listing lifecycle." },
        { status: 400 }
      );
    }
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

  try {
    await purgeListingForAdmin({
      client,
      listing,
      actorId: auth.user.id,
      reason: parsed.reason,
      dependencySummary,
    });
    return NextResponse.json({
      ok: true,
      action: "purge",
      id: listingId,
      title: listing.title ?? null,
      dependencySummary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update listing lifecycle." },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return patchAdminListingLifecycleResponse(request, id);
}
