import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getUserRole, requireOwnership, requireUser } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getPaygConfig } from "@/lib/billing/payg";
import { consumeListingCredit, issueTrialCreditsIfEligible } from "@/lib/billing/listing-credits.server";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { hasPinnedLocation } from "@/lib/properties/validation";
import { requireLegalAcceptance } from "@/lib/legal/guard.server";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";
import { logFailure } from "@/lib/observability";
import { isShortletProperty } from "@/lib/shortlet/discovery";
import { normalizeShortletNightlyPriceMinor } from "@/lib/shortlet/listing-setup";

export const dynamic = "force-dynamic";

const routeLabel = "/api/properties/[id]/submit";

const bodySchema = z
  .object({
    idempotencyKey: z.string().min(8).optional(),
  })
  .optional();

type ListingRow = {
  id: string;
  owner_id: string;
  status?: string | null;
  submitted_at?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
  listing_intent?: string | null;
  rental_type?: string | null;
};

export type ListingSubmitDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  getListingAccessResult: typeof getListingAccessResult;
  hasActiveDelegation: typeof hasActiveDelegation;
  getPaygConfig: typeof getPaygConfig;
  consumeListingCredit: typeof consumeListingCredit;
  issueTrialCreditsIfEligible: typeof issueTrialCreditsIfEligible;
  getAppSettingBool: typeof getAppSettingBool;
  requireLegalAcceptance: typeof requireLegalAcceptance;
  logPropertyEvent: typeof logPropertyEvent;
  resolveEventSessionKey: typeof resolveEventSessionKey;
  logFailure: typeof logFailure;
};

const defaultDeps: ListingSubmitDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireUser,
  getUserRole,
  getListingAccessResult,
  hasActiveDelegation,
  getPaygConfig,
  consumeListingCredit,
  issueTrialCreditsIfEligible,
  getAppSettingBool,
  requireLegalAcceptance,
  logPropertyEvent,
  resolveEventSessionKey,
  logFailure,
};

export async function postPropertySubmitResponse(
  request: NextRequest,
  propertyId: string,
  deps: ListingSubmitDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured", code: "SERVER_ERROR" }, { status: 503 });
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
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = bodySchema.parse(await request.json().catch(() => ({})));
  const idempotencyKey = payload?.idempotencyKey || crypto.randomUUID();

  const adminClient = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : null;
  const lookupClient = adminClient ?? supabase;

  const { data: listing, error: listingError } = await lookupClient
    .from("properties")
    .select(
      "id, owner_id, status, submitted_at, is_active, is_approved, latitude, longitude, location_label, location_place_id, listing_intent, rental_type"
    )
    .eq("id", propertyId)
    .maybeSingle<ListingRow>();

  if (listingError || !listing) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: listingError || "Listing not found",
    });
    return NextResponse.json({ error: "Listing not found", code: "LISTING_NOT_FOUND" }, { status: 404 });
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

  if (role !== "admin") {
    const legalCheck = await deps.requireLegalAcceptance({
      request,
      supabase,
      userId: auth.user.id,
      role,
    });
    if (!legalCheck.ok) {
      return legalCheck.response;
    }
  }

  const requiresPin = await deps.getAppSettingBool("require_location_pin_for_publish", false);
  if (
    role !== "admin" &&
    requiresPin &&
    !hasPinnedLocation({
      latitude: listing.latitude,
      longitude: listing.longitude,
      location_label: listing.location_label,
      location_place_id: listing.location_place_id,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Pin a location to publish this listing.", code: "LOCATION_PIN_REQUIRED" },
      { status: 400 }
    );
  }

  const isShortletListing = isShortletProperty({
    listing_intent: listing.listing_intent,
    rental_type: listing.rental_type,
  });
  if (isShortletListing) {
    const settingsClient = adminClient ?? supabase;
    const { data: settingsRow } = await settingsClient
      .from("shortlet_settings")
      .select("nightly_price_minor")
      .eq("property_id", propertyId)
      .maybeSingle();
    const nightlyPriceMinor = normalizeShortletNightlyPriceMinor(
      settingsRow?.nightly_price_minor
    );
    if (!nightlyPriceMinor) {
      return NextResponse.json(
        {
          ok: false,
          error: "Set a nightly price before submitting this shortlet.",
          code: "SHORTLET_NIGHTLY_PRICE_REQUIRED",
        },
        { status: 409 }
      );
    }
  }

  const sessionKey = deps.resolveEventSessionKey({ request, userId: auth.user.id });
  await deps.logPropertyEvent({
    supabase,
    propertyId,
    eventType: "listing_submit_attempted",
    actorUserId: auth.user.id,
    actorRole: role,
    sessionKey,
  });

  if (listing.status === "pending" || listing.status === "live") {
    return NextResponse.json({ ok: true, status: listing.status, idempotencyKey });
  }

  const ownerId = listing.owner_id;
  let ownerRole = role;
  if (listing.owner_id && listing.owner_id !== auth.user.id) {
    const roleClient = adminClient ?? supabase;
    const { data: ownerProfile } = await roleClient
      .from("profiles")
      .select("role")
      .eq("id", listing.owner_id)
      .maybeSingle();
    if (ownerProfile?.role) {
      ownerRole = ownerProfile.role as typeof role;
    }
  }
  const shouldConsumeCredit = !listing.submitted_at;
  if (shouldConsumeCredit && role !== "admin") {
    if (!adminClient) {
      return NextResponse.json(
        { error: "Service role not configured", code: "SERVER_ERROR" },
        { status: 503 }
      );
    }
    const paygConfig = await deps.getPaygConfig();
    let creditResult = await deps.consumeListingCredit({
      client: adminClient,
      userId: ownerId,
      listingId: propertyId,
      idempotencyKey,
    });

    if (!creditResult.ok && creditResult.reason === "NO_CREDITS") {
      const trialCredits =
        ownerRole === "agent" ? paygConfig.trialAgentCredits : paygConfig.trialLandlordCredits;
      if (trialCredits > 0) {
        await deps.issueTrialCreditsIfEligible({
          client: adminClient,
          userId: ownerId,
          role: ownerRole,
          credits: trialCredits,
        });
        creditResult = await deps.consumeListingCredit({
          client: adminClient,
          userId: ownerId,
          listingId: propertyId,
          idempotencyKey,
        });
      }
    }

    if (!creditResult.ok && creditResult.reason === "NO_CREDITS") {
      await deps.logPropertyEvent({
        supabase,
        propertyId,
        eventType: "listing_submit_blocked_no_credits",
        actorUserId: auth.user.id,
        actorRole: role,
        sessionKey,
        meta: { ownerId },
      });
      if (!paygConfig.enabled) {
        return NextResponse.json(
          { ok: false, reason: "PAYG_DISABLED", error: "PAYG is disabled." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          reason: "PAYMENT_REQUIRED",
          amount: paygConfig.amount,
          currency: paygConfig.currency,
          idempotencyKey,
        },
        { status: 402 }
      );
    }

    if (!creditResult.ok && creditResult.reason === "NOT_OWNER") {
      return NextResponse.json({ error: "Forbidden", code: "NOT_OWNER" }, { status: 403 });
    }

    if (creditResult.ok && creditResult.consumed) {
      await deps.logPropertyEvent({
        supabase,
        propertyId,
        eventType: "listing_credit_consumed",
        actorUserId: auth.user.id,
        actorRole: role,
        sessionKey,
        meta: { source: creditResult.source ?? null },
      });
    }
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("properties")
    .update({
      status: "pending",
      is_active: true,
      is_approved: false,
      approved_at: null,
      rejected_at: null,
      paused_at: null,
      paused_reason: null,
      expired_at: null,
      expires_at: null,
      submitted_at: listing.submitted_at ?? nowIso,
      status_updated_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", propertyId);

  if (updateError) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: updateError,
    });
    return NextResponse.json(
      { error: "Unable to submit listing", code: "SUBMIT_FAILED" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, status: "pending", idempotencyKey });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postPropertySubmitResponse(request, id);
}
