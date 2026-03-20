import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeProviderPlanUpdate,
  computeValidUntil,
  isProviderEventProcessed,
  normalizeCadence,
} from "@/lib/billing/provider-payments";
import { getPaystackConfig } from "@/lib/billing/paystack";
import { type PlanTier } from "@/lib/plans";
import { issueReferralRewardsForEvent } from "@/lib/referrals/referrals.server";
import {
  issueSubscriptionCreditsIfNeeded,
  upsertSubscriptionRecord,
} from "@/lib/billing/subscription-credits.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type PaystackSubscriptionEventRow = {
  id: string;
  profile_id: string;
  plan_tier: string | null;
  cadence: string | null;
  status: string | null;
  processed_at: string | null;
  mode: string | null;
  amount: number | null;
  currency: string | null;
  transaction_id: string | null;
};

type VerifyPayload = {
  status?: boolean | null;
  message?: string | null;
  data?: {
    status?: string | null;
    id?: string | number | null;
  } | null;
};

type VerifyTransactionDeps = {
  fetchImpl?: typeof fetch;
  getConfig?: typeof getPaystackConfig;
  upsertSubscriptionRecordFn?: typeof upsertSubscriptionRecord;
  issueSubscriptionCreditsIfNeededFn?: typeof issueSubscriptionCreditsIfNeeded;
  issueReferralRewardsFn?: typeof issueReferralRewardsForEvent;
};

export type FinalizePaystackSubscriptionResult =
  | {
      status: "not_found";
      httpStatus: 404;
      profileId: null;
      planTier: null;
      validUntil: null;
      mode: null;
      reason: "reference_not_found";
      retryable: false;
    }
  | {
      status: "already_processed" | "verified" | "skipped";
      httpStatus: 200;
      profileId: string;
      planTier: string | null;
      validUntil: string | null;
      mode: "test" | "live";
      reason: string | null;
      retryable: false;
    }
  | {
      status: "failed";
      httpStatus: 400 | 409 | 500 | 502 | 503;
      profileId: string;
      planTier: string | null;
      validUntil: string | null;
      mode: "test" | "live";
      reason: string;
      retryable: boolean;
    };

export async function getPaystackSubscriptionEventByReference({
  adminClient,
  reference,
}: {
  adminClient: UntypedAdminClient;
  reference: string;
}) {
  const { data } = await adminClient
    .from<PaystackSubscriptionEventRow>("provider_payment_events")
    .select(
      "id, profile_id, plan_tier, cadence, status, processed_at, mode, amount, currency, transaction_id"
    )
    .eq("provider", "paystack")
    .eq("reference", reference)
    .maybeSingle();

  return (data as PaystackSubscriptionEventRow | null) ?? null;
}

async function markEventStatus({
  adminClient,
  eventId,
  status,
  reason,
  transactionId,
  processed,
}: {
  adminClient: UntypedAdminClient;
  eventId: string;
  status: "failed" | "skipped" | "verified";
  reason: string | null;
  transactionId?: string | null;
  processed?: boolean;
}) {
  const values: Record<string, unknown> = {
    status,
    reason,
  };
  if (typeof transactionId !== "undefined") {
    values.transaction_id = transactionId;
  }
  if (processed) {
    values.processed_at = new Date().toISOString();
  }
  await adminClient.from("provider_payment_events").update(values).eq("id", eventId);
}

async function verifyPaystackSubscriptionTransaction({
  reference,
  mode,
  fetchImpl = fetch,
  getConfig = getPaystackConfig,
}: {
  reference: string;
  mode: "test" | "live";
} & VerifyTransactionDeps) {
  const config = await getConfig(mode);
  if (!config.keyPresent) {
    return {
      ok: false as const,
      config,
      reason: "config_missing",
      httpStatus: 503 as const,
      retryable: true,
      payload: null,
      transactionId: null,
    };
  }
  if (mode === "live" && config.fallbackFromLive) {
    return {
      ok: false as const,
      config,
      reason: "live_keys_missing",
      httpStatus: 503 as const,
      retryable: true,
      payload: null,
      transactionId: null,
    };
  }

  const verifyRes = await fetchImpl(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        authorization: `Bearer ${config.secretKey}`,
      },
    }
  );
  const payload = (await verifyRes.json().catch(() => null)) as VerifyPayload | null;
  if (!verifyRes.ok || !payload?.status) {
    return {
      ok: false as const,
      config,
      reason: "verify_failed",
      httpStatus: 502 as const,
      retryable: true,
      payload,
      transactionId: null,
    };
  }

  const transactionStatus = payload.data?.status ?? null;
  const transactionId = payload.data?.id ? String(payload.data.id) : null;
  if (transactionStatus !== "success") {
    return {
      ok: false as const,
      config,
      reason: `status_${transactionStatus || "unknown"}`,
      httpStatus: 409 as const,
      retryable: false,
      payload,
      transactionId,
    };
  }

  return {
    ok: true as const,
    config,
    payload,
    transactionId,
  };
}

export async function finalizePaystackSubscriptionEvent({
  adminClient,
  reference,
  event,
  actorUserId,
  fetchImpl,
  getConfig,
  upsertSubscriptionRecordFn = upsertSubscriptionRecord,
  issueSubscriptionCreditsIfNeededFn = issueSubscriptionCreditsIfNeeded,
  issueReferralRewardsFn = issueReferralRewardsForEvent,
}: {
  adminClient: UntypedAdminClient;
  reference: string;
  event?: PaystackSubscriptionEventRow | null;
  actorUserId?: string | null;
  fetchImpl?: typeof fetch;
  getConfig?: typeof getPaystackConfig;
  upsertSubscriptionRecordFn?: typeof upsertSubscriptionRecord;
  issueSubscriptionCreditsIfNeededFn?: typeof issueSubscriptionCreditsIfNeeded;
  issueReferralRewardsFn?: typeof issueReferralRewardsForEvent;
}): Promise<FinalizePaystackSubscriptionResult> {
  const subscriptionEvent =
    typeof event === "undefined"
      ? await getPaystackSubscriptionEventByReference({ adminClient, reference })
      : event;

  if (!subscriptionEvent) {
    return {
      status: "not_found",
      httpStatus: 404,
      profileId: null,
      planTier: null,
      validUntil: null,
      mode: null,
      reason: "reference_not_found",
      retryable: false,
    };
  }

  const mode = subscriptionEvent.mode === "live" ? "live" : "test";
  if (
    isProviderEventProcessed({
      status: subscriptionEvent.status,
      processed_at: subscriptionEvent.processed_at,
    })
  ) {
    return {
      status:
        subscriptionEvent.status === "verified"
          ? "verified"
          : subscriptionEvent.status === "skipped"
            ? "skipped"
            : "already_processed",
      httpStatus: 200,
      profileId: subscriptionEvent.profile_id,
      planTier: subscriptionEvent.plan_tier,
      validUntil: null,
      mode,
      reason:
        subscriptionEvent.status === "skipped"
          ? "manual_override"
          : subscriptionEvent.status === "verified"
            ? null
            : "already_processed",
      retryable: false,
    };
  }

  if (!subscriptionEvent.plan_tier) {
    await markEventStatus({
      adminClient,
      eventId: subscriptionEvent.id,
      status: "failed",
      reason: "missing_metadata",
    });
    return {
      status: "failed",
      httpStatus: 400,
      profileId: subscriptionEvent.profile_id,
      planTier: null,
      validUntil: null,
      mode,
      reason: "missing_metadata",
      retryable: false,
    };
  }

  if (!["starter", "pro", "tenant_pro"].includes(subscriptionEvent.plan_tier)) {
    await markEventStatus({
      adminClient,
      eventId: subscriptionEvent.id,
      status: "failed",
      reason: "invalid_plan_tier",
    });
    return {
      status: "failed",
      httpStatus: 400,
      profileId: subscriptionEvent.profile_id,
      planTier: subscriptionEvent.plan_tier,
      validUntil: null,
      mode,
      reason: "invalid_plan_tier",
      retryable: false,
    };
  }

  const normalizedTier = subscriptionEvent.plan_tier as PlanTier;
  const verification = await verifyPaystackSubscriptionTransaction({
    reference,
    mode,
    fetchImpl,
    getConfig,
  });

  if (!verification.ok) {
    const reason = verification.reason;
    if (reason === "verify_failed" || reason.startsWith("status_")) {
      await markEventStatus({
        adminClient,
        eventId: subscriptionEvent.id,
        status: "failed",
        reason,
        transactionId: verification.transactionId,
      });
    }

    return {
      status: "failed",
      httpStatus: verification.httpStatus,
      profileId: subscriptionEvent.profile_id,
      planTier: normalizedTier,
      validUntil: null,
      mode,
      reason,
      retryable: verification.retryable,
    };
  }

  const { data: existingPlan } = await adminClient
    .from("profile_plans")
    .select("billing_source, plan_tier, valid_until")
    .eq("profile_id", subscriptionEvent.profile_id)
    .maybeSingle();

  const validUntil = computeValidUntil(normalizeCadence(subscriptionEvent.cadence));
  const decision = computeProviderPlanUpdate(
    normalizedTier,
    validUntil,
    (existingPlan as {
      billing_source?: string | null;
      plan_tier?: string | null;
      valid_until?: string | null;
    } | null) ?? null
  );

  if (decision.skipped) {
    await markEventStatus({
      adminClient,
      eventId: subscriptionEvent.id,
      status: "skipped",
      reason: decision.skipReason || "manual_override",
      transactionId: verification.transactionId,
      processed: true,
    });

    return {
      status: "skipped",
      httpStatus: 200,
      profileId: subscriptionEvent.profile_id,
      planTier: decision.planTier,
      validUntil: decision.validUntil,
      mode,
      reason: decision.skipReason || "manual_override",
      retryable: false,
    };
  }

  const nowIso = new Date().toISOString();
  const actorId = actorUserId ?? null;
  const { error: planError } = await adminClient.from("profile_plans").upsert(
    {
      profile_id: subscriptionEvent.profile_id,
      plan_tier: decision.planTier,
      billing_source: "paystack",
      valid_until: decision.validUntil,
      updated_at: nowIso,
      updated_by: actorId,
      upgraded_at: nowIso,
      upgraded_by: actorId,
    },
    { onConflict: "profile_id" }
  );

  if (planError) {
    await markEventStatus({
      adminClient,
      eventId: subscriptionEvent.id,
      status: "failed",
      reason: "plan_update_failed",
      transactionId: verification.transactionId,
    });
    return {
      status: "failed",
      httpStatus: 500,
      profileId: subscriptionEvent.profile_id,
      planTier: normalizedTier,
      validUntil: null,
      mode,
      reason: "plan_update_failed",
      retryable: true,
    };
  }

  const subscriptionRow = await upsertSubscriptionRecordFn({
    adminClient: adminClient as unknown as SupabaseClient,
    userId: subscriptionEvent.profile_id,
    provider: "paystack",
    providerSubscriptionId: reference,
    status: "active",
    planTier: decision.planTier,
    currentPeriodStart: nowIso,
    currentPeriodEnd: decision.validUntil,
    canceledAt: null,
  });

  if (subscriptionRow?.id) {
    await issueSubscriptionCreditsIfNeededFn({
      adminClient: adminClient as unknown as SupabaseClient,
      subscriptionId: subscriptionRow.id,
      userId: subscriptionEvent.profile_id,
      planTier: decision.planTier,
      periodStart: nowIso,
      periodEnd: decision.validUntil,
    });
  }

  await markEventStatus({
    adminClient,
    eventId: subscriptionEvent.id,
    status: "verified",
    reason: null,
    transactionId: verification.transactionId,
    processed: true,
  });

  try {
    await issueReferralRewardsFn({
      client: adminClient as unknown as SupabaseClient,
      referredUserId: subscriptionEvent.profile_id,
      eventType: "subscription_paid",
      eventReference: `paystack:${reference}`,
    });
  } catch {
    // Referral rewards should never block subscription finalization.
  }

  return {
    status: "verified",
    httpStatus: 200,
    profileId: subscriptionEvent.profile_id,
    planTier: decision.planTier,
    validUntil: decision.validUntil,
    mode,
    reason: null,
    retryable: false,
  };
}
