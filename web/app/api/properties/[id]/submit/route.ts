import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getUserRole, requireOwnership, requireUser } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getPaygConfig } from "@/lib/billing/payg";
import { consumeListingCredit, issueTrialCreditsIfEligible } from "@/lib/billing/listing-credits.server";
import {
  buildListingEntitlementIdempotencyKey,
  buildListingMonetizationResumeUrl,
  ensureListingPublishEntitlement,
  type ListingMonetizationContext,
} from "@/lib/billing/listing-publish-entitlement.server";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { hasPinnedLocation } from "@/lib/properties/validation";
import { requireLegalAcceptance } from "@/lib/legal/guard.server";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";
import { logFailure, logPlanLimitHit } from "@/lib/observability";
import { isShortletProperty } from "@/lib/shortlet/discovery";
import { normalizeShortletNightlyPriceMinor } from "@/lib/shortlet/listing-setup";
import { buildLiveApprovalUpdate } from "@/lib/properties/expiry";
import { getListingExpiryDays } from "@/lib/properties/expiry.server";
import { normalizeListingQualitySubmitTelemetry } from "@/lib/properties/listing-quality-telemetry";
import {
  formatListingIntentLabel,
  formatListingPropertyTypeLabel,
  notifyAdminsOfListingReviewSubmission,
} from "@/lib/admin/listing-review-notifications.server";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import {
  buildActiveListingLimitRecoveryPayload,
  enforceActiveListingLimit,
} from "@/lib/plan-enforcement";
import { loadCanadaRentalPaygRuntimeDecision } from "@/lib/billing/canada-payg-runtime.server";
import { sanitizeUserFacingErrorMessage } from "@/lib/observability/user-facing-errors";
import { captureServerException } from "@/lib/monitoring/sentry";

export const dynamic = "force-dynamic";

const routeLabel = "/api/properties/[id]/submit";
const SUBMIT_LISTING_ERROR = "We couldn’t submit this listing right now. Try again in a moment.";

const bodySchema = z
  .object({
    idempotencyKey: z.string().min(8).optional(),
    qualityTelemetry: z.unknown().optional(),
  })
  .optional();

type ListingRow = {
  id: string;
  owner_id: string;
  title?: string | null;
  city?: string | null;
  country_code?: string | null;
  status?: string | null;
  status_updated_at?: string | null;
  submitted_at?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
  listing_intent?: string | null;
  rental_type?: string | null;
  listing_type?: string | null;
};

function resolveSubmitMonetizationContext(status?: string | null): ListingMonetizationContext {
  if (status === "expired") return "renewal";
  if (status === "paused_owner" || status === "paused_occupied") return "reactivation";
  return "submission";
}

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
  getListingExpiryDays: typeof getListingExpiryDays;
  requireLegalAcceptance: typeof requireLegalAcceptance;
  logPropertyEvent: typeof logPropertyEvent;
  resolveEventSessionKey: typeof resolveEventSessionKey;
  logFailure: typeof logFailure;
  notifyAdminsOfListingReviewSubmission?: typeof notifyAdminsOfListingReviewSubmission;
  loadCanadaRentalPaygRuntimeDecision?: typeof loadCanadaRentalPaygRuntimeDecision;
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
  getListingExpiryDays,
  requireLegalAcceptance,
  logPropertyEvent,
  resolveEventSessionKey,
  logFailure,
  notifyAdminsOfListingReviewSubmission,
  loadCanadaRentalPaygRuntimeDecision,
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
  const qualityTelemetry = normalizeListingQualitySubmitTelemetry(payload?.qualityTelemetry);

  const adminClient = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : null;
  const lookupClient = adminClient ?? supabase;

  const { data: listing, error: listingError } = await lookupClient
    .from("properties")
    .select(
      "id, owner_id, title, city, country_code, status, status_updated_at, submitted_at, is_active, is_approved, latitude, longitude, location_label, location_place_id, listing_intent, rental_type, listing_type"
    )
    .eq("id", propertyId)
    .maybeSingle<ListingRow>();

  if (listingError) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: listingError,
    });
    captureServerException(listingError, {
      route: routeLabel,
      request,
      status: 500,
      userId: auth.user.id,
      userRole: role,
      listingId: propertyId,
      tags: {
        flow: "listing_submit",
        stage: "listing_lookup",
      },
    });
    return NextResponse.json(
      { error: SUBMIT_LISTING_ERROR, code: "SERVER_ERROR" },
      { status: 500 }
    );
  }

  if (!listing) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: "Listing not found",
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
  const idempotencyKey =
    payload?.idempotencyKey ||
    buildListingEntitlementIdempotencyKey({
      context: resolveSubmitMonetizationContext(listing.status),
      listingId: propertyId,
      listingStatus: listing.status,
      submittedAt: listing.submitted_at ?? null,
      statusUpdatedAt: listing.status_updated_at ?? null,
    });
  await deps.logPropertyEvent({
    supabase,
    propertyId,
    eventType: "listing_submit_attempted",
    actorUserId: auth.user.id,
    actorRole: role,
    sessionKey,
    meta: qualityTelemetry
      ? {
          quality_source: qualityTelemetry.source,
          quality_best_next_fix_key: qualityTelemetry.bestNextFixKey,
          quality_score_before: qualityTelemetry.scoreBefore,
          quality_score_at_submit: qualityTelemetry.scoreAtSubmit,
          quality_score_improved: qualityTelemetry.scoreImproved,
          quality_missing_count_before: qualityTelemetry.missingCountBefore,
          quality_missing_count_at_submit: qualityTelemetry.missingCountAtSubmit,
        }
      : undefined,
  });

  if (listing.status === "pending" || listing.status === "live") {
    return NextResponse.json({ ok: true, status: listing.status, idempotencyKey });
  }

  const ownerId = listing.owner_id;
  let ownerRole = role;
  let ownerName: string | null = null;
  if (listing.owner_id && listing.owner_id !== auth.user.id) {
    const roleClient = adminClient ?? supabase;
    const { data: ownerProfile } = await roleClient
      .from("profiles")
      .select("role, display_name, full_name")
      .eq("id", listing.owner_id)
      .maybeSingle();
    if (ownerProfile?.role) {
      ownerRole = ownerProfile.role as typeof role;
    }
    ownerName = String(ownerProfile?.display_name || ownerProfile?.full_name || "").trim() || null;
  }
  if (!ownerName && listing.owner_id === auth.user.id) {
    ownerName = auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.name ?? null;
  }
  const monetizationContext = resolveSubmitMonetizationContext(listing.status);
  if (role !== "admin") {
    if (!adminClient) {
      return NextResponse.json(
        { error: "Service role not configured", code: "SERVER_ERROR" },
        { status: 503 }
      );
    }
    const activeLimit = await enforceActiveListingLimit({
      supabase,
      ownerId,
      serviceClient: adminClient,
      excludeId: propertyId,
    });
    if (
      listing.country_code?.toUpperCase() === "CA" &&
      deps.loadCanadaRentalPaygRuntimeDecision &&
      !activeLimit.usage.error
    ) {
      try {
        await deps.loadCanadaRentalPaygRuntimeDecision({
          serviceClient: adminClient,
          ownerId,
          listingId: propertyId,
          marketCountry: listing.country_code,
          listingIntent: listing.listing_intent,
          rentalType: listing.rental_type,
          role: ownerRole,
          tier: activeLimit.usage.plan.tier,
          activeListingCount: activeLimit.usage.activeCount,
        });
      } catch (error) {
        deps.logFailure({
          request,
          route: routeLabel,
          status: 200,
          startTime,
          level: "warn",
          error,
        });
      }
    }
    if (!activeLimit.ok) {
      if (activeLimit.usage.error) {
        deps.logFailure({
          request,
          route: routeLabel,
          status: 500,
          startTime,
          error: new Error(activeLimit.usage.error),
        });
        captureServerException(new Error(activeLimit.usage.error), {
          route: routeLabel,
          request,
          status: 500,
          userId: auth.user.id,
          userRole: role,
          listingId: propertyId,
          tags: {
            flow: "listing_submit",
            stage: "active_limit_lookup",
          },
          extra: {
            ownerId,
          },
        });
        return NextResponse.json({ error: SUBMIT_LISTING_ERROR }, { status: 500 });
      }
      logPlanLimitHit({
        request,
        route: routeLabel,
        actorId: auth.user.id,
        ownerId,
        propertyId,
        planTier: activeLimit.planTier,
        maxListings: activeLimit.maxListings,
        activeCount: activeLimit.activeCount,
        source: activeLimit.usage.source,
      });
      return NextResponse.json(
        {
          ok: false,
          ...buildActiveListingLimitRecoveryPayload({
            gate: activeLimit,
            requesterRole: role,
            context: monetizationContext,
            propertyId,
          }),
        },
        { status: 409 }
      );
    }
    const entitlement = await ensureListingPublishEntitlement(
      {
        adminClient,
        ownerId,
        ownerRole,
        requesterRole: role,
        listingId: propertyId,
        idempotencyKey,
      },
      {
        getPaygConfig: deps.getPaygConfig,
        consumeListingCredit: deps.consumeListingCredit,
        issueTrialCreditsIfEligible: deps.issueTrialCreditsIfEligible,
      }
    );

    if (!entitlement.ok && entitlement.reason !== "SERVER_ERROR") {
      const resumeUrl = buildListingMonetizationResumeUrl({
        propertyId,
        reason: entitlement.reason,
        context: monetizationContext,
        amount: entitlement.amount,
        currency: entitlement.currency,
      });
      await deps.logPropertyEvent({
        supabase,
        propertyId,
        eventType: "listing_submit_blocked_no_credits",
        actorUserId: auth.user.id,
        actorRole: role,
        sessionKey,
        meta: { ownerId, context: monetizationContext, reason: entitlement.reason },
      });
      if (entitlement.reason === "BILLING_REQUIRED") {
        return NextResponse.json(
          {
            ok: false,
            reason: entitlement.reason,
            error: "Free posting limit reached. Choose a plan before submitting this listing.",
            billingUrl: entitlement.billingUrl,
            resumeUrl,
            idempotencyKey: entitlement.idempotencyKey,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          reason: entitlement.reason,
          error: "Free posting limit reached. Payment is required before submitting this listing.",
          amount: entitlement.amount,
          currency: entitlement.currency,
          billingUrl: entitlement.billingUrl,
          resumeUrl,
          idempotencyKey: entitlement.idempotencyKey,
        },
        { status: 402 }
      );
    }

    if (!entitlement.ok) {
      const technicalError = entitlement.error || "listing_submit_entitlement_server_error";
      deps.logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: new Error(technicalError),
      });
      captureServerException(new Error(technicalError), {
        route: routeLabel,
        request,
        status: 500,
        userId: auth.user.id,
        userRole: role,
        listingId: propertyId,
        tags: {
          flow: "listing_submit",
          stage: "publish_entitlement",
        },
        extra: {
          ownerId,
          context: monetizationContext,
        },
      });
      return NextResponse.json(
        { error: SUBMIT_LISTING_ERROR, code: "SERVER_ERROR" },
        { status: 500 }
      );
    }

    if (entitlement.consumed) {
      await deps.logPropertyEvent({
        supabase,
        propertyId,
        eventType: "listing_credit_consumed",
        actorUserId: auth.user.id,
        actorRole: role,
        sessionKey,
        meta: { source: entitlement.source ?? null, context: monetizationContext },
      });
    }
  }

  const autoApproveEnabled = await deps.getAppSettingBool(
    APP_SETTING_KEYS.listingsAutoApproveEnabled,
    false
  );
  const now = new Date();
  const nowIso = now.toISOString();
  const nextStatus = autoApproveEnabled ? "live" : "pending";
  const autoApproveUpdate = autoApproveEnabled
    ? buildLiveApprovalUpdate({
        now,
        expiryDays: await deps.getListingExpiryDays(),
      })
    : null;
  const { error: updateError } = await supabase
    .from("properties")
    .update({
      ...(autoApproveUpdate ?? {
        status: "pending",
        is_active: true,
        is_approved: false,
        approved_at: null,
        rejected_at: null,
      }),
      paused_at: null,
      paused_reason: null,
      expired_at: null,
      expires_at: autoApproveUpdate?.expires_at ?? null,
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
    captureServerException(updateError, {
      route: routeLabel,
      request,
      status: 500,
      userId: auth.user.id,
      userRole: role,
      listingId: propertyId,
      tags: {
        flow: "listing_submit",
        stage: "property_update",
      },
    });
    return NextResponse.json(
      {
        error: sanitizeUserFacingErrorMessage(updateError.message, SUBMIT_LISTING_ERROR),
        code: "SUBMIT_FAILED",
      },
      { status: 500 }
    );
  }

  await logProductAnalyticsEvent({
    eventName: autoApproveEnabled ? "listing_published_live" : "listing_submitted_for_review",
    request,
    supabase,
    userId: auth.user.id,
    userRole: role,
    properties: {
      market: listing.country_code ?? undefined,
      role,
      intent: listing.listing_intent ?? undefined,
      city: listing.city ?? undefined,
      propertyType: listing.listing_type ?? listing.rental_type ?? undefined,
      listingId: propertyId,
      listingStatus: nextStatus,
    },
  });

  if (autoApproveEnabled) {
    await deps.logPropertyEvent({
      supabase,
      propertyId,
      eventType: "listing_auto_approved",
      actorUserId: auth.user.id,
      actorRole: role,
      sessionKey,
      meta: {
        settingKey: APP_SETTING_KEYS.listingsAutoApproveEnabled,
      },
    });
    console.info("[listing-submit] auto-approved", {
      propertyId,
      actorId: auth.user.id,
      at: nowIso,
    });
  }

  if (!autoApproveEnabled && deps.notifyAdminsOfListingReviewSubmission) {
    try {
      await deps.notifyAdminsOfListingReviewSubmission({
        propertyId,
        listingTitle: listing.title ?? null,
        marketLabel: listing.country_code ?? listing.city ?? null,
        propertyTypeLabel:
          formatListingPropertyTypeLabel(listing.listing_type ?? listing.rental_type ?? null),
        intentLabel: formatListingIntentLabel(listing.listing_intent ?? null),
        ownerName,
        submittedAt: nowIso,
      });
    } catch (error) {
      console.error("[listing-submit] admin review email notification failed", {
        propertyId,
        error,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    idempotencyKey,
    autoApproved: autoApproveEnabled,
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postPropertySubmitResponse(request, id);
}
