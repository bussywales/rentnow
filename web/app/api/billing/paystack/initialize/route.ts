import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getSiteUrl } from "@/lib/env";
import { resolveProviderPricing, normalizeCadence, resolveTierForRole } from "@/lib/billing/provider-payments";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getPaystackConfig } from "@/lib/billing/paystack";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logFailure, logProviderCheckoutStarted } from "@/lib/observability";

const routeLabel = "/api/billing/paystack/initialize";

const payloadSchema = z.object({
  tier: z.enum(["starter", "pro", "tenant_pro"]),
  cadence: z.enum(["monthly", "yearly"]).optional(),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "tenant"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; Paystack is unavailable." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const cadence = normalizeCadence(parsed.data.cadence);
  const tier = resolveTierForRole(auth.role, parsed.data.tier);
  if (!tier) {
    return NextResponse.json({ error: "Plan tier not available for your role." }, { status: 400 });
  }

  const { paystackMode } = await getProviderModes();
  const config = await getPaystackConfig(paystackMode);
  if (!config.keyPresent) {
    return NextResponse.json(
      { error: "Paystack is not configured. Add keys in Admin → Billing settings." },
      { status: 503 }
    );
  }
  if (paystackMode === "live" && config.fallbackFromLive) {
    return NextResponse.json(
      { error: "Paystack live mode requires live keys. Switch to test or set live keys." },
      { status: 503 }
    );
  }

  if (!auth.user.email) {
    return NextResponse.json({ error: "Account email is required for checkout." }, { status: 400 });
  }

  const pricing = resolveProviderPricing({
    provider: "paystack",
    role: auth.role,
    tier,
    cadence,
  });

  const reference = `ps_${crypto.randomUUID()}`;
  const baseUrl = await getSiteUrl();
  const callbackUrl = `${baseUrl}/dashboard/billing?provider=paystack`;
  const metadata = {
    profile_id: auth.user.id,
    plan_tier: tier,
    cadence,
    mode: config.mode,
    provider: "paystack",
  };

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify({
        email: auth.user.email,
        amount: pricing.amountMinor,
        currency: pricing.currency,
        reference,
        callback_url: callbackUrl,
        metadata,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
      logFailure({
        request,
        route: routeLabel,
        status: response.status || 502,
        startTime,
        level: "warn",
        error: payload?.message || "paystack_initialize_failed",
      });
      return NextResponse.json(
        { error: payload?.message || "Paystack initialization failed." },
        { status: 502 }
      );
    }

    const adminClient = createServiceRoleClient();
    const adminDb = adminClient as unknown as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options?: { onConflict?: string }
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await adminDb
      .from("provider_payment_events")
      .upsert(
        {
          provider: "paystack",
          mode: config.mode,
          reference: payload.data.reference || reference,
          event_type: "initialize",
          status: "initialized",
          profile_id: auth.user.id,
          plan_tier: tier,
          cadence,
          amount: pricing.amountMinor,
          currency: pricing.currency,
        },
        { onConflict: "provider,reference" }
      );
    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        level: "warn",
        error: error.message,
      });
      return NextResponse.json(
        { error: "Unable to record Paystack checkout. Try again." },
        { status: 500 }
      );
    }

    logProviderCheckoutStarted({
      request,
      route: routeLabel,
      provider: "paystack",
      mode: config.mode,
      profileId: auth.user.id,
      planTier: tier,
      cadence,
    });

    return NextResponse.json({
      ok: true,
      url: payload.data.authorization_url,
      reference: payload.data.reference || reference,
      mode: config.mode,
      providerKeyPresent: config.keyPresent,
    });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Paystack request failed." }, { status: 502 });
  }
}
