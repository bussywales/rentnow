import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { buildRenewalUpdate, isListingExpired } from "@/lib/properties/expiry";
import { getListingExpiryDays } from "@/lib/properties/expiry.server";
import { getPaygConfig } from "@/lib/billing/payg";
import { consumeListingCredit, issueTrialCreditsIfEligible } from "@/lib/billing/listing-credits.server";
import {
  buildListingEntitlementIdempotencyKey,
  buildListingMonetizationResumeUrl,
  ensureListingPublishEntitlement,
} from "@/lib/billing/listing-publish-entitlement.server";
import type { UserRole } from "@/lib/types";
import { enforceActiveListingLimit } from "@/lib/plan-enforcement";
import { logPlanLimitHit } from "@/lib/observability";

export const dynamic = "force-dynamic";

export type RenewDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  getListingAccessResult: typeof getListingAccessResult;
  hasActiveDelegation: typeof hasActiveDelegation;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getListingExpiryDays: typeof getListingExpiryDays;
  getPaygConfig: typeof getPaygConfig;
  consumeListingCredit: typeof consumeListingCredit;
  issueTrialCreditsIfEligible: typeof issueTrialCreditsIfEligible;
};

const defaultDeps: RenewDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getUserRole,
  getListingAccessResult,
  hasActiveDelegation,
  hasServiceRoleEnv,
  createServiceRoleClient,
  getListingExpiryDays,
  getPaygConfig,
  consumeListingCredit,
  issueTrialCreditsIfEligible,
};

export async function postPropertyRenewResponse(
  request: NextRequest,
  id: string,
  deps: RenewDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({
    request,
    route: `/api/properties/${id}/renew`,
    startTime,
    supabase,
  });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  const access = deps.getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status }
    );
  }

  const actingAs = readActingAsFromRequest(request);
  let ownerId = auth.user.id;
  if (role === "agent" && actingAs && actingAs !== auth.user.id) {
    const allowed = await deps.hasActiveDelegation(supabase, auth.user.id, actingAs);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    ownerId = actingAs;
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id, status, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (property.owner_id !== ownerId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isListingExpired(property)) {
    return NextResponse.json({ error: "Listing is not expired" }, { status: 400 });
  }

  if (role !== "admin") {
    if (!deps.hasServiceRoleEnv()) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
    }
    const adminClient = deps.createServiceRoleClient();
    const activeLimit = await enforceActiveListingLimit({
      supabase,
      ownerId: property.owner_id,
      serviceClient: adminClient,
      excludeId: id,
    });
    if (!activeLimit.ok) {
      if (activeLimit.usage.error) {
        return NextResponse.json({ error: activeLimit.usage.error }, { status: 500 });
      }
      logPlanLimitHit({
        request,
        route: `/api/properties/${id}/renew`,
        actorId: auth.user.id,
        ownerId: property.owner_id,
        propertyId: id,
        planTier: activeLimit.planTier,
        maxListings: activeLimit.maxListings,
        activeCount: activeLimit.activeCount,
        source: activeLimit.usage.source,
      });
      return NextResponse.json(
        {
          error: activeLimit.error,
          code: activeLimit.code,
          maxListings: activeLimit.maxListings,
          activeCount: activeLimit.activeCount,
          planTier: activeLimit.planTier,
        },
        { status: 409 }
      );
    }
    const ownerRole: UserRole | null =
      property.owner_id !== auth.user.id && role === "agent" ? "landlord" : role;
    const idempotencyKey = buildListingEntitlementIdempotencyKey({
      context: "renewal",
      listingId: id,
      listingStatus: property.status,
      expiresAt: property.expires_at ?? null,
    });
    const entitlement = await ensureListingPublishEntitlement(
      {
        adminClient,
        ownerId: property.owner_id,
        ownerRole,
        requesterRole: role,
        listingId: id,
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
        propertyId: id,
        reason: entitlement.reason,
        context: "renewal",
        amount: entitlement.amount,
        currency: entitlement.currency,
      });
      if (entitlement.reason === "BILLING_REQUIRED") {
        return NextResponse.json(
          {
            error: "Free posting limit reached. Choose a plan before renewing this listing.",
            reason: entitlement.reason,
            billingUrl: entitlement.billingUrl,
            resumeUrl,
            idempotencyKey: entitlement.idempotencyKey,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: "Free posting limit reached. Payment is required before renewing this listing.",
          reason: entitlement.reason,
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
      return NextResponse.json(
        { error: entitlement.error || "Unable to verify listing entitlement." },
        { status: 500 }
      );
    }
  }

  const expiryDays = await deps.getListingExpiryDays();
  const updates = buildRenewalUpdate({ now: new Date(), expiryDays });
  const { error } = await supabase.from("properties").update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to renew" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "live" });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postPropertyRenewResponse(request, id);
}
