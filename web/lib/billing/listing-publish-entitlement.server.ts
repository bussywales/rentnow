import type { SupabaseClient } from "@supabase/supabase-js";
import { getPaygConfig } from "@/lib/billing/payg";
import {
  consumeListingCredit,
  issueTrialCreditsIfEligible,
} from "@/lib/billing/listing-credits.server";
import { buildHostPropertyEditHref } from "@/lib/routing/dashboard-properties-legacy";
import type { UserRole } from "@/lib/types";

export type ListingMonetizationReason = "PAYMENT_REQUIRED" | "BILLING_REQUIRED";
export type ListingMonetizationContext = "submission" | "renewal" | "reactivation";

export function buildListingEntitlementIdempotencyKey(input: {
  context: ListingMonetizationContext;
  listingId: string;
  listingStatus?: string | null;
  submittedAt?: string | null;
  expiresAt?: string | null;
  pausedAt?: string | null;
  statusUpdatedAt?: string | null;
}) {
  const normalizedStatus = String(input.listingStatus || "unknown").trim().toLowerCase() || "unknown";

  if (input.context === "renewal") {
    return `listing:${input.listingId}:renewal:${input.expiresAt || "none"}`;
  }

  if (input.context === "reactivation") {
    return `listing:${input.listingId}:reactivation:${normalizedStatus}:${input.pausedAt || input.statusUpdatedAt || input.expiresAt || "none"}`;
  }

  return `listing:${input.listingId}:submission:${normalizedStatus}:${input.submittedAt || input.statusUpdatedAt || "none"}`;
}

export type ListingPublishEntitlementResult =
  | {
      ok: true;
      consumed: boolean;
      alreadyConsumed: boolean;
      source: string | null;
      idempotencyKey: string;
    }
  | {
      ok: false;
      reason: ListingMonetizationReason;
      amount?: number;
      currency?: string;
      billingUrl: string;
      idempotencyKey: string;
    }
  | {
      ok: false;
      reason: "SERVER_ERROR";
      error: string;
    };

type ListingPublishEntitlementDeps = {
  getPaygConfig: typeof getPaygConfig;
  consumeListingCredit: typeof consumeListingCredit;
  issueTrialCreditsIfEligible: typeof issueTrialCreditsIfEligible;
};

const defaultDeps: ListingPublishEntitlementDeps = {
  getPaygConfig,
  consumeListingCredit,
  issueTrialCreditsIfEligible,
};

export function resolveListingBillingUrl(role?: UserRole | null) {
  return role === "tenant" ? "/tenant/billing#plans" : "/dashboard/billing#plans";
}

export function buildListingMonetizationResumeUrl({
  propertyId,
  reason,
  context,
  amount,
  currency,
}: {
  propertyId: string;
  reason: ListingMonetizationReason;
  context: ListingMonetizationContext;
  amount?: number;
  currency?: string;
}) {
  const params = new URLSearchParams({
    step: "submit",
    monetization: reason.toLowerCase(),
    monetization_context: context,
  });
  if (typeof amount === "number" && Number.isFinite(amount)) {
    params.set("monetization_amount", String(amount));
  }
  if (currency) {
    params.set("monetization_currency", currency);
  }
  return buildHostPropertyEditHref(propertyId, Object.fromEntries(params.entries()));
}

export async function ensureListingPublishEntitlement(
  input: {
    adminClient: SupabaseClient;
    ownerId: string;
    ownerRole: UserRole | null;
    requesterRole: UserRole | null;
    listingId: string;
    idempotencyKey: string;
  },
  deps: ListingPublishEntitlementDeps = defaultDeps
): Promise<ListingPublishEntitlementResult> {
  const billingUrl = resolveListingBillingUrl(input.requesterRole);
  const paygConfig = await deps.getPaygConfig();

  let creditResult = await deps.consumeListingCredit({
    client: input.adminClient,
    userId: input.ownerId,
    listingId: input.listingId,
    idempotencyKey: input.idempotencyKey,
  });

  if (!creditResult.ok && creditResult.reason === "NO_CREDITS") {
    const trialEligibleRole =
      input.ownerRole === "agent" || input.ownerRole === "landlord" ? input.ownerRole : null;
    const trialCredits =
      trialEligibleRole === "agent"
        ? paygConfig.trialAgentCredits
        : trialEligibleRole === "landlord"
          ? paygConfig.trialLandlordCredits
          : 0;
    if (trialEligibleRole && trialCredits > 0) {
      await deps.issueTrialCreditsIfEligible({
        client: input.adminClient,
        userId: input.ownerId,
        role: trialEligibleRole,
        credits: trialCredits,
      });
      creditResult = await deps.consumeListingCredit({
        client: input.adminClient,
        userId: input.ownerId,
        listingId: input.listingId,
        idempotencyKey: input.idempotencyKey,
      });
    }
  }

  if (!creditResult.ok && creditResult.reason === "NO_CREDITS") {
    if (!paygConfig.enabled) {
      return {
        ok: false,
        reason: "BILLING_REQUIRED",
        billingUrl,
        idempotencyKey: input.idempotencyKey,
      };
    }
    return {
      ok: false,
      reason: "PAYMENT_REQUIRED",
      amount: paygConfig.amount,
      currency: paygConfig.currency,
      billingUrl,
      idempotencyKey: input.idempotencyKey,
    };
  }

  if (!creditResult.ok) {
    return {
      ok: false,
      reason: "SERVER_ERROR",
      error: creditResult.reason || "Unable to verify listing entitlement.",
    };
  }

  return {
    ok: true,
    consumed: creditResult.consumed,
    alreadyConsumed: Boolean(creditResult.alreadyConsumed),
    source: creditResult.source ?? null,
    idempotencyKey: creditResult.idempotencyKey ?? input.idempotencyKey,
  };
}
