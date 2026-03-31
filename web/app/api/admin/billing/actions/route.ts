import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { logBillingSourceRestored, logPlanOverride } from "@/lib/observability";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import { restoreStripeProviderBilling } from "@/lib/billing/stripe-provider-recovery";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/billing/actions";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("extend_valid_until"),
    profileId: z.string().uuid(),
    days: z.number().int().positive().max(365).optional(),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("expire_now"),
    profileId: z.string().uuid(),
    reason: z.string().max(500),
  }),
  z.object({
    action: z.literal("set_plan_tier"),
    profileId: z.string().uuid(),
    planTier: z.enum(["free", "starter", "pro", "tenant_pro"]),
    maxListingsOverride: z.number().int().positive().max(1_000).nullable().optional(),
    validUntil: z.string().datetime().nullable().optional(),
    reason: z.string().max(500),
  }),
  z.object({
    action: z.literal("return_to_provider_billing"),
    profileId: z.string().uuid(),
    reason: z.string().max(500),
  }),
]);

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

export async function POST(request: Request) {
  const startTime = Date.now();

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; billing actions unavailable." },
      { status: 503 }
    );
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const payload = actionSchema.parse(await request.json());
  const reason = (payload as { reason?: string }).reason?.trim() ?? "";
  if (
    (payload.action === "expire_now" ||
      payload.action === "set_plan_tier" ||
      payload.action === "return_to_provider_billing") &&
    !reason
  ) {
    return NextResponse.json({ error: "Reason is required for this action." }, { status: 400 });
  }
  const adminClient = createServiceRoleClient();

  const { data: existingPlan } = await adminClient
    .from("profile_plans")
    .select(
      "plan_tier, valid_until, max_listings_override, billing_source, stripe_customer_id, stripe_subscription_id, stripe_status, stripe_price_id, stripe_current_period_end"
    )
    .eq("profile_id", payload.profileId)
    .maybeSingle();

  if (payload.action === "return_to_provider_billing") {
    const { stripeMode } = await getProviderModes();
    const stripeConfig = getStripeConfigForMode(stripeMode);
    if (!stripeConfig.secretKey) {
      return NextResponse.json({ error: "Stripe is not configured for provider re-sync." }, { status: 503 });
    }

    const stripe = getStripeClient(stripeConfig.secretKey);
    const restored = await restoreStripeProviderBilling({
      adminClient: adminClient as never,
      stripe,
      profileId: payload.profileId,
      actorId: auth.user.id,
    });

    if (!restored.ok) {
      const status =
        restored.code === "not_manual_override"
          ? 409
          : restored.code === "missing_provider_state" || restored.code === "missing_plan_mapping"
          ? 422
          : restored.code === "stripe_fetch_failed"
          ? 502
          : 400;
      return NextResponse.json({ error: restored.error, code: restored.code }, { status });
    }

    const stamp = new Date().toISOString();
    const { data: existing } = await adminClient
      .from("profile_billing_notes")
      .select("billing_notes")
      .eq("profile_id", payload.profileId)
      .maybeSingle();
    const existingNotes = (existing as { billing_notes?: string | null } | null)?.billing_notes ?? "";
    const recoveryLine = [
      `[${stamp}] Support action: ${payload.action}. Reason: ${reason}`,
      `Restored billing_source=stripe`,
      `plan_tier=${restored.planTier}`,
      `stripe_subscription_id=${restored.stripeSubscriptionId}`,
      restored.usedFallbackSubscriptionId ? "subscription_id_source=subscriptions_table" : "subscription_id_source=profile_plans",
    ].join(". ");
    const updatedNotes = existingNotes ? `${existingNotes}\n${recoveryLine}` : recoveryLine;
    const adminDb = adminClient as unknown as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options?: { onConflict?: string }
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
    await adminDb
      .from("profile_billing_notes")
      .upsert(
        {
          profile_id: payload.profileId,
          billing_notes: updatedNotes,
          updated_at: stamp,
          updated_by: auth.user.id,
        },
        { onConflict: "profile_id" }
      );

    logBillingSourceRestored({
      request,
      route: routeLabel,
      actorId: auth.user.id,
      profileId: payload.profileId,
      previousBillingSource:
        (existingPlan as { billing_source?: string | null } | null)?.billing_source ?? "manual",
      restoredBillingSource: "stripe",
      planTier: restored.planTier,
      stripeSubscriptionId: restored.stripeSubscriptionId,
    });

    return NextResponse.json({
      ok: true,
      billingSource: restored.billingSource,
      planTier: restored.planTier,
      validUntil: restored.validUntil,
      stripeStatus: restored.stripeStatus,
      stripeSubscriptionId: restored.stripeSubscriptionId,
      stripePriceId: restored.stripePriceId,
    });
  }

  const planTier =
    payload.action === "set_plan_tier"
      ? payload.planTier
      : ((existingPlan as { plan_tier?: string | null } | null)?.plan_tier ?? "free");

  const now = new Date();
  let validUntil: string | null =
    (existingPlan as { valid_until?: string | null } | null)?.valid_until ?? null;
  let maxListingsOverride: number | null =
    (existingPlan as { max_listings_override?: number | null } | null)?.max_listings_override ??
    null;

  if (payload.action === "extend_valid_until") {
    const days = payload.days ?? 30;
    const base = validUntil && Date.parse(validUntil) > Date.now() ? new Date(validUntil) : now;
    validUntil = addDays(base, days).toISOString();
  }

  if (payload.action === "expire_now") {
    validUntil = now.toISOString();
  }

  if (payload.action === "set_plan_tier") {
    validUntil = payload.validUntil ?? validUntil;
    maxListingsOverride = payload.maxListingsOverride ?? null;
  }

  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await adminDb
    .from("profile_plans")
    .upsert(
      {
        profile_id: payload.profileId,
        plan_tier: planTier,
        billing_source: "manual",
        valid_until: validUntil,
        max_listings_override: maxListingsOverride,
        updated_at: now.toISOString(),
        updated_by: auth.user.id,
        upgraded_at: now.toISOString(),
        upgraded_by: auth.user.id,
      },
      { onConflict: "profile_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (reason) {
    const { data: existing } = await adminClient
      .from("profile_billing_notes")
      .select("billing_notes")
      .eq("profile_id", payload.profileId)
      .maybeSingle();
    const existingNotes = (existing as { billing_notes?: string | null } | null)?.billing_notes ?? "";
    const stamp = new Date().toISOString();
    const noteLine = `[${stamp}] Support action: ${payload.action}. Reason: ${reason}`;
    const updatedNotes = existingNotes ? `${existingNotes}\n${noteLine}` : noteLine;
    await adminDb
      .from("profile_billing_notes")
      .upsert(
        {
          profile_id: payload.profileId,
          billing_notes: updatedNotes,
          updated_at: stamp,
          updated_by: auth.user.id,
        },
        { onConflict: "profile_id" }
      );
  }

  logPlanOverride({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    profileId: payload.profileId,
    planTier,
    maxListingsOverride,
    billingSource: "manual",
    validUntil,
  });

  return NextResponse.json({
    ok: true,
    planTier,
    validUntil,
    maxListingsOverride,
  });
}
