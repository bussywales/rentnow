import type Stripe from "stripe";
import { resolvePlanFromStripe } from "@/lib/billing/stripe-webhook";
import { computeStripePlanUpdate } from "@/lib/billing/stripe-plan-update";
import { issueSubscriptionCreditsIfNeeded, upsertSubscriptionRecord } from "@/lib/billing/subscription-credits.server";

type AdminClientLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        in?: (column: string, values: string[]) => {
          order: (
            column: string,
            options?: { ascending?: boolean; nullsFirst?: boolean }
          ) => {
            limit: (count: number) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
          };
        };
      };
      order?: (
        column: string,
        options?: { ascending?: boolean; nullsFirst?: boolean }
      ) => {
        limit: (count: number) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
      };
    };
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string }
    ) => Promise<{ error: { message?: string } | null }>;
  };
};

type StripeLike = {
  subscriptions: {
    retrieve: (
      subscriptionId: string,
      options?: { expand?: string[] }
    ) => Promise<Stripe.Subscription>;
  };
};

type ExistingPlan = {
  billing_source?: string | null;
  plan_tier?: string | null;
  valid_until?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
};

type SubscriptionLookupRow = {
  provider_subscription_id?: string | null;
};

type RecoveryResult =
  | {
      ok: true;
      planTier: string;
      validUntil: string | null;
      billingSource: "stripe";
      stripeStatus: string | null;
      stripeSubscriptionId: string;
      stripePriceId: string | null;
      usedFallbackSubscriptionId: boolean;
    }
  | {
      ok: false;
      code:
        | "not_manual_override"
        | "missing_provider_state"
        | "stripe_fetch_failed"
        | "missing_plan_mapping"
        | "profile_plan_update_failed";
      error: string;
    };

function toIso(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

async function loadExistingPlan(adminClient: AdminClientLike, profileId: string) {
  const { data, error } = await adminClient
    .from("profile_plans")
    .select(
      "billing_source, plan_tier, valid_until, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_status, stripe_current_period_end"
    )
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load billing state.");
  }

  return (data as ExistingPlan | null) ?? null;
}

async function loadFallbackStripeSubscriptionId(adminClient: AdminClientLike, profileId: string) {
  const subscriptionsQuery = adminClient
    .from("subscriptions")
    .select("provider_subscription_id")
    .eq("user_id", profileId) as unknown as {
    in: (column: string, values: string[]) => {
      order: (
        column: string,
        options?: { ascending?: boolean; nullsFirst?: boolean }
      ) => {
        limit: (count: number) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
      };
    };
  };

  const { data, error } = await subscriptionsQuery
    .in("status", ["active", "trialing", "past_due", "unpaid", "canceled"])
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(5);

  if (error) {
    throw new Error(error.message || "Unable to load provider subscriptions.");
  }

  const row = ((data as SubscriptionLookupRow[] | null) ?? []).find(
    (candidate) =>
      typeof candidate.provider_subscription_id === "string" &&
      candidate.provider_subscription_id.trim().length > 0
  );

  return row?.provider_subscription_id ?? null;
}

export async function restoreStripeProviderBilling({
  adminClient,
  stripe,
  profileId,
  actorId,
  upsertSubscriptionRecordFn = upsertSubscriptionRecord,
  issueSubscriptionCreditsIfNeededFn = issueSubscriptionCreditsIfNeeded,
}: {
  adminClient: AdminClientLike;
  stripe: StripeLike;
  profileId: string;
  actorId: string;
  upsertSubscriptionRecordFn?: typeof upsertSubscriptionRecord;
  issueSubscriptionCreditsIfNeededFn?: typeof issueSubscriptionCreditsIfNeeded;
}): Promise<RecoveryResult> {
  const existingPlan = await loadExistingPlan(adminClient, profileId);

  if (existingPlan?.billing_source !== "manual") {
    return {
      ok: false,
      code: "not_manual_override",
      error: "This account is not currently under a manual billing override.",
    };
  }

  const directSubscriptionId = existingPlan.stripe_subscription_id ?? null;
  const fallbackSubscriptionId =
    directSubscriptionId || (await loadFallbackStripeSubscriptionId(adminClient, profileId));
  const stripeSubscriptionId = fallbackSubscriptionId;
  const usedFallbackSubscriptionId = !directSubscriptionId && !!stripeSubscriptionId;

  if (!stripeSubscriptionId) {
    return {
      ok: false,
      code: "missing_provider_state",
      error: "No linked Stripe subscription was found for this account.",
    };
  }

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["items.data.price"],
    });
  } catch (error) {
    return {
      ok: false,
      code: "stripe_fetch_failed",
      error: error instanceof Error ? error.message : "Unable to fetch Stripe subscription.",
    };
  }

  const plan = resolvePlanFromStripe(subscription, undefined);
  if (!plan.tier) {
    return {
      ok: false,
      code: "missing_plan_mapping",
      error: "The linked Stripe subscription does not map to a known PropatyHub plan tier.",
    };
  }

  const currentPeriodStart = toIso(subscription.current_period_start);
  const currentPeriodEnd = toIso(subscription.current_period_end);
  const decision = computeStripePlanUpdate(
    {
      tier: plan.tier,
      status: subscription.status,
      currentPeriodEnd,
      allowImmediateDowngrade: false,
      ignoreManualOverride: true,
    },
    existingPlan
  );

  const now = new Date().toISOString();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };

  const { error } = await adminDb
    .from("profile_plans")
    .upsert(
      {
        profile_id: profileId,
        plan_tier: decision.planTier,
        billing_source: "stripe",
        valid_until: decision.validUntil,
        max_listings_override: null,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: plan.priceId,
        stripe_current_period_end: currentPeriodEnd,
        stripe_status: subscription.status,
        updated_at: now,
        updated_by: actorId,
      },
      { onConflict: "profile_id" }
    );

  if (error) {
    return {
      ok: false,
      code: "profile_plan_update_failed",
      error: error.message || "Unable to restore provider-owned billing.",
    };
  }

  const subscriptionRow = await upsertSubscriptionRecordFn({
    adminClient: adminClient as never,
    userId: profileId,
    provider: "stripe",
    providerSubscriptionId: subscription.id,
    status: subscription.status ?? null,
    planTier: plan.tier,
    currentPeriodStart,
    currentPeriodEnd,
    canceledAt: subscription.canceled_at ? toIso(subscription.canceled_at) : null,
  });

  if (subscriptionRow?.id && ["active", "trialing", "past_due", "unpaid"].includes(subscription.status)) {
    await issueSubscriptionCreditsIfNeededFn({
      adminClient: adminClient as never,
      subscriptionId: subscriptionRow.id,
      userId: profileId,
      planTier: plan.tier,
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
    });
  }

  return {
    ok: true,
    planTier: decision.planTier,
    validUntil: decision.validUntil,
    billingSource: "stripe",
    stripeStatus: subscription.status,
    stripeSubscriptionId: subscription.id,
    stripePriceId: plan.priceId,
    usedFallbackSubscriptionId,
  };
}
