import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { dispatchSavedSearchAlerts } from "@/lib/alerts/tenant-alerts";
import { getUserRole, requireOwnership, requireUser } from "@/lib/authz";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { logFailure, logPlanLimitHit } from "@/lib/observability";
import { getListingAccessResult } from "@/lib/role-access";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { computeExpiryAt } from "@/lib/properties/expiry";
import { getListingExpiryDays } from "@/lib/properties/expiry.server";
import { hasPinnedLocation } from "@/lib/properties/validation";
import { cleanNullableString } from "@/lib/strings";
import { isPausedStatus, normalizePropertyStatus } from "@/lib/properties/status";

export const dynamic = "force-dynamic";

const routeLabel = "/api/properties/[id]/status";

const bodySchema = z
  .object({
    status: z.enum(["live", "paused", "paused_owner", "paused_occupied"]),
    paused_reason: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (isPausedStatus(value.status)) {
      const trimmed = (value.paused_reason ?? "").trim();
      if (!trimmed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paused_reason"],
          message: "Pause reason is required",
        });
      }
    }
  });

export type ListingStatusDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  getListingAccessResult: typeof getListingAccessResult;
  hasActiveDelegation: typeof hasActiveDelegation;
  getAppSettingBool: typeof getAppSettingBool;
  getPlanUsage: typeof getPlanUsage;
  getListingExpiryDays: typeof getListingExpiryDays;
  dispatchSavedSearchAlerts: typeof dispatchSavedSearchAlerts;
  logFailure: typeof logFailure;
};

const defaultDeps: ListingStatusDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireUser,
  getUserRole,
  getListingAccessResult,
  hasActiveDelegation,
  getAppSettingBool,
  getPlanUsage,
  getListingExpiryDays,
  dispatchSavedSearchAlerts,
  logFailure,
};

export async function postPropertyStatusResponse(
  request: NextRequest,
  propertyId: string,
  deps: ListingStatusDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  const access = deps.getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status }
    );
  }

  const body = await request.json();
  const { status, paused_reason } = bodySchema.parse(body);
  const normalizedStatus = normalizePropertyStatus(status) ?? status;

  const adminClient = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : null;
  const lookupClient = adminClient ?? supabase;
  const { data: listing, error: fetchError } = await lookupClient
    .from("properties")
    .select(
      "id, owner_id, status, is_active, is_approved, approved_at, latitude, longitude, location_label, location_place_id"
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (fetchError || !listing) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: fetchError || "Listing not found",
    });
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const ownership = requireOwnership({
    request,
    route: routeLabel,
    startTime,
    resourceOwnerId: listing.owner_id,
    userId: auth.user.id,
    role,
    allowRoles: ["admin"],
  });
  if (!ownership.ok) {
    if (role === "agent") {
      const allowed = await deps.hasActiveDelegation(supabase, auth.user.id, listing.owner_id);
      if (!allowed) return ownership.response;
    } else {
      return ownership.response;
    }
  }

  const wasPaused = isPausedStatus(listing.status);
  const isPauseRequest = isPausedStatus(normalizedStatus);
  const isReactivateRequest = normalizedStatus === "live";

  if (isPauseRequest && normalizePropertyStatus(listing.status) !== "live") {
    return NextResponse.json(
      { error: "Only live listings can be paused." },
      { status: 400 }
    );
  }

  if (isReactivateRequest && !wasPaused) {
    return NextResponse.json(
      { error: "Listing is not paused." },
      { status: 400 }
    );
  }

  if (isReactivateRequest && role !== "admin" && listing.is_approved !== true) {
    return NextResponse.json(
      { error: "Listing must be approved before reactivating." },
      { status: 409 }
    );
  }

  if (isReactivateRequest && role !== "admin") {
    const requiresPin = await deps.getAppSettingBool("require_location_pin_for_publish", false);
    if (
      requiresPin &&
      !hasPinnedLocation({
        latitude: listing.latitude,
        longitude: listing.longitude,
        location_label: listing.location_label,
        location_place_id: listing.location_place_id,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pin a location to publish this listing.",
          code: "LOCATION_PIN_REQUIRED",
        },
        { status: 400 }
      );
    }
  }

  const willActivate = isReactivateRequest && !listing.is_active;
  if (willActivate && role !== "admin") {
    const usage = await deps.getPlanUsage({
      supabase,
      ownerId: listing.owner_id,
      serviceClient: adminClient,
      excludeId: propertyId,
    });
    if (usage.error) {
      deps.logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: new Error(usage.error),
      });
      return NextResponse.json({ error: usage.error }, { status: 500 });
    }
    if (usage.activeCount >= usage.plan.maxListings) {
      logPlanLimitHit({
        request,
        route: routeLabel,
        actorId: auth.user.id,
        ownerId: listing.owner_id,
        propertyId,
        planTier: usage.plan.tier,
        maxListings: usage.plan.maxListings,
        activeCount: usage.activeCount,
        source: usage.source,
      });
      return NextResponse.json(
        {
          error: "Plan limit reached",
          code: "plan_limit_reached",
          maxListings: usage.plan.maxListings,
          activeCount: usage.activeCount,
          planTier: usage.plan.tier,
        },
        { status: 409 }
      );
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const updates: Record<string, unknown> = {
    status: normalizedStatus,
    status_updated_at: nowIso,
    updated_at: nowIso,
  };

  if (isPauseRequest) {
    updates.paused_at = nowIso;
    updates.paused_reason = cleanNullableString(paused_reason, { allowUndefined: false });
    updates.is_active = false;
  }

  if (isReactivateRequest) {
    const expiryDays = await deps.getListingExpiryDays();
    updates.reactivated_at = nowIso;
    updates.is_active = true;
    updates.is_approved = true;
    updates.paused_at = null;
    updates.paused_reason = null;
    updates.expired_at = null;
    updates.expires_at = computeExpiryAt(now, expiryDays);
  }

  const { data: updated, error: updateError } = await supabase
    .from("properties")
    .update(updates)
    .eq("id", propertyId)
    .select(
      "id, status, paused_at, reactivated_at, status_updated_at, paused_reason, is_active, is_approved, expires_at"
    )
    .maybeSingle();

  if (updateError) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(updateError.message),
    });
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (willActivate && updated?.is_active && updated?.is_approved) {
    try {
      const alertResult = await deps.dispatchSavedSearchAlerts(propertyId);
      if (!alertResult.ok) {
        deps.logFailure({
          request,
          route: routeLabel,
          status: alertResult.status ?? 500,
          startTime,
          error: new Error(alertResult.error ?? "Alert dispatch failed"),
        });
      }
    } catch (err) {
      deps.logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: err,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    id: propertyId,
    status: updated?.status ?? normalizedStatus,
    paused_at: updated?.paused_at ?? null,
    reactivated_at: updated?.reactivated_at ?? null,
    status_updated_at: updated?.status_updated_at ?? nowIso,
    paused_reason: updated?.paused_reason ?? null,
    is_active: updated?.is_active ?? null,
    is_approved: updated?.is_approved ?? null,
    expires_at: updated?.expires_at ?? null,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postPropertyStatusResponse(request, id);
}
