import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { computeValidUntil, computeProviderPlanUpdate, isProviderEventProcessed, normalizeCadence, resolveTierForRole } from "@/lib/billing/provider-payments";
import { getPaystackConfig } from "@/lib/billing/paystack";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { logFailure, logProviderPlanUpdated, logProviderVerifyOutcome } from "@/lib/observability";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  issueSubscriptionCreditsIfNeeded,
  upsertSubscriptionRecord,
} from "@/lib/billing/subscription-credits.server";
import { type PlanTier } from "@/lib/plans";
import { issueReferralRewardsForEvent } from "@/lib/referrals/referrals.server";

const routeLabel = "/api/billing/paystack/verify";

const payloadSchema = z.object({
  reference: z.string().min(8),
});

type ProviderPaymentEventRow = {
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

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "tenant", "admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; Paystack verification unavailable." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const reference = parsed.data.reference;
  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as unknown as UntypedAdminClient;

  const { data: event } = await adminDb
    .from<ProviderPaymentEventRow>("provider_payment_events")
    .select("id, profile_id, plan_tier, cadence, status, processed_at, mode, amount, currency, transaction_id")
    .eq("provider", "paystack")
    .eq("reference", reference)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Payment reference not found." }, { status: 404 });
  }

  if (auth.role !== "admin" && event.profile_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isProviderEventProcessed({ status: event.status, processed_at: event.processed_at })) {
    if (event.status === "verified") {
      try {
        await issueReferralRewardsForEvent({
          client: adminDb as unknown as SupabaseClient,
          referredUserId: event.profile_id,
          eventType: "subscription_paid",
          eventReference: `paystack:${reference}`,
        });
      } catch {
        // Referral rewards should never block subscription verification responses.
      }
    }
    logProviderVerifyOutcome({
      request,
      route: routeLabel,
      provider: "paystack",
      mode: event.mode || "test",
      reference,
      outcome: "already_processed",
      profileId: event.profile_id,
    });
    return NextResponse.json({ ok: true, status: "already_processed" });
  }

  if (!event.plan_tier) {
    await adminDb
      .from("provider_payment_events")
      .update({ status: "failed", reason: "missing_metadata" })
      .eq("id", event.id);
    logProviderVerifyOutcome({
      request,
      route: routeLabel,
      provider: "paystack",
      mode: event.mode || "test",
      reference,
      outcome: "failed",
      reason: "missing_metadata",
      profileId: event.profile_id,
    });
    return NextResponse.json({ error: "Payment metadata missing." }, { status: 400 });
  }

  if (!["starter", "pro", "tenant_pro"].includes(event.plan_tier)) {
    await adminDb
      .from("provider_payment_events")
      .update({ status: "failed", reason: "invalid_plan_tier" })
      .eq("id", event.id);
    return NextResponse.json({ error: "Invalid plan tier." }, { status: 400 });
  }

  const normalizedTier = event.plan_tier as PlanTier;

  if (auth.role !== "admin" && !resolveTierForRole(auth.role, normalizedTier)) {
    await adminDb
      .from("provider_payment_events")
      .update({ status: "failed", reason: "role_mismatch" })
      .eq("id", event.id);
    return NextResponse.json({ error: "Plan tier not allowed for this role." }, { status: 403 });
  }

  const eventMode = event.mode === "live" ? "live" : "test";
  const config = await getPaystackConfig(eventMode);
  if (!config.keyPresent) {
    return NextResponse.json(
      { error: "Paystack is not configured. Add keys in Admin → Billing settings." },
      { status: 503 }
    );
  }
  if (eventMode === "live" && config.fallbackFromLive) {
    return NextResponse.json(
      { error: "Paystack live mode requires live keys. Switch to test or set live keys." },
      { status: 503 }
    );
  }

  try {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        authorization: `Bearer ${config.secretKey}`,
      },
    });
    const payload = await verifyRes.json().catch(() => null);
    if (!verifyRes.ok || !payload?.status) {
      await adminDb
        .from("provider_payment_events")
        .update({ status: "failed", reason: "verify_failed" })
        .eq("id", event.id);
      logProviderVerifyOutcome({
        request,
        route: routeLabel,
        provider: "paystack",
        mode: config.mode,
        reference,
        outcome: "failed",
        reason: "verify_failed",
        profileId: event.profile_id,
      });
      return NextResponse.json(
        { error: payload?.message || "Paystack verification failed." },
        { status: 502 }
      );
    }

    const transactionStatus = payload?.data?.status;
    const transactionId = payload?.data?.id ? String(payload.data.id) : null;
    if (transactionStatus !== "success") {
      await adminDb
        .from("provider_payment_events")
        .update({
          status: "failed",
          reason: `status_${transactionStatus || "unknown"}`,
          transaction_id: transactionId,
        })
        .eq("id", event.id);
      logProviderVerifyOutcome({
        request,
        route: routeLabel,
        provider: "paystack",
        mode: config.mode,
        reference,
        outcome: "failed",
        reason: `status_${transactionStatus || "unknown"}`,
        profileId: event.profile_id,
      });
      return NextResponse.json({ error: "Payment not successful." }, { status: 409 });
    }

    const { data: existingPlan } = await adminDb
      .from("profile_plans")
      .select("billing_source, plan_tier, valid_until")
      .eq("profile_id", event.profile_id)
      .maybeSingle();

    const validUntil = computeValidUntil(normalizeCadence(event.cadence));
    const decision = computeProviderPlanUpdate(normalizedTier, validUntil, existingPlan as {
      billing_source?: string | null;
      plan_tier?: string | null;
      valid_until?: string | null;
    } | null);

    if (decision.skipped) {
      await adminDb
        .from("provider_payment_events")
        .update({
          status: "skipped",
          reason: decision.skipReason || "manual_override",
          processed_at: new Date().toISOString(),
          transaction_id: transactionId,
        })
        .eq("id", event.id);

      logProviderVerifyOutcome({
        request,
        route: routeLabel,
        provider: "paystack",
        mode: config.mode,
        reference,
        outcome: "skipped",
        reason: decision.skipReason || "manual_override",
        profileId: event.profile_id,
      });

      return NextResponse.json({ ok: true, status: "skipped", reason: decision.skipReason });
    }

    const nowIso = new Date().toISOString();
    const { error } = await adminDb
      .from("profile_plans")
      .upsert(
        {
          profile_id: event.profile_id,
          plan_tier: decision.planTier,
          billing_source: "paystack",
          valid_until: decision.validUntil,
          updated_at: nowIso,
          updated_by: auth.user.id,
          upgraded_at: nowIso,
          upgraded_by: auth.user.id,
        },
        { onConflict: "profile_id" }
      );

    if (error) {
      await adminDb
        .from("provider_payment_events")
        .update({ status: "failed", reason: "plan_update_failed", transaction_id: transactionId })
        .eq("id", event.id);
      logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: error.message,
      });
      return NextResponse.json({ error: "Unable to apply plan update." }, { status: 500 });
    }

    const subscriptionRow = await upsertSubscriptionRecord({
      adminClient: adminDb as unknown as SupabaseClient,
      userId: event.profile_id,
      provider: "paystack",
      providerSubscriptionId: reference,
      status: "active",
      planTier: decision.planTier,
      currentPeriodStart: nowIso,
      currentPeriodEnd: decision.validUntil,
      canceledAt: null,
    });

    if (subscriptionRow?.id) {
      await issueSubscriptionCreditsIfNeeded({
        adminClient: adminDb as unknown as SupabaseClient,
        subscriptionId: subscriptionRow.id,
        userId: event.profile_id,
        planTier: decision.planTier,
        periodStart: nowIso,
        periodEnd: decision.validUntil,
      });
    }

    await adminDb
      .from("provider_payment_events")
      .update({
        status: "verified",
        reason: null,
        processed_at: nowIso,
        transaction_id: transactionId,
      })
      .eq("id", event.id);

    logProviderPlanUpdated({
      request,
      route: routeLabel,
      provider: "paystack",
      profileId: event.profile_id,
      planTier: decision.planTier,
      billingSource: "paystack",
      validUntil: decision.validUntil,
    });

    logProviderVerifyOutcome({
      request,
      route: routeLabel,
      provider: "paystack",
      mode: config.mode,
      reference,
      outcome: "verified",
      profileId: event.profile_id,
    });

    try {
      await issueReferralRewardsForEvent({
        client: adminDb as unknown as SupabaseClient,
        referredUserId: event.profile_id,
        eventType: "subscription_paid",
        eventReference: `paystack:${reference}`,
      });
    } catch {
      // Referral rewards should never block subscription verification responses.
    }

    return NextResponse.json({ ok: true, status: "verified", valid_until: decision.validUntil });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Paystack verification failed." }, { status: 502 });
  }
}
