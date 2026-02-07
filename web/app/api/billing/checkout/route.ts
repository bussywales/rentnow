import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getUserRole, requireUser, requireOwnership } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getPaystackConfig } from "@/lib/billing/paystack";
import { getPaygConfig } from "@/lib/billing/payg";
import { getSiteUrl } from "@/lib/env";
import { logFailure } from "@/lib/observability";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";

const routeLabel = "/api/billing/checkout";

const payloadSchema = z.object({
  listingId: z.string().uuid(),
  purpose: z.literal("listing_submission"),
  idempotencyKey: z.string().min(8).optional(),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(supabase, auth.user.id);
  const access = getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { listingId, idempotencyKey } = parsed.data;
  const adminClient = createServiceRoleClient();
  const lookupClient = adminClient;

  const { data: listing, error: listingError } = await lookupClient
    .from("properties")
    .select("id, owner_id, status")
    .eq("id", listingId)
    .maybeSingle<{ id: string; owner_id: string; status?: string | null }>();

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.status === "pending" || listing.status === "live") {
    return NextResponse.json({ error: "Listing already submitted." }, { status: 409 });
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
      const allowed = await hasActiveDelegation(supabase, auth.user.id, listing.owner_id);
      if (!allowed) return ownership.response;
    } else {
      return ownership.response;
    }
  }

  const paygConfig = await getPaygConfig();
  if (!paygConfig.enabled) {
    return NextResponse.json({ error: "PAYG is disabled." }, { status: 409 });
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

  const reference = `ps_${crypto.randomUUID()}`;
  const amountMinor = Math.round(paygConfig.amount * 100);
  const baseUrl = await getSiteUrl();
  const callbackUrl = `${baseUrl}/dashboard/properties/${listingId}?payment=payg`;
  const paymentIdempotency = idempotencyKey || crypto.randomUUID();

  if (!auth.user.email) {
    return NextResponse.json({ error: "Account email is required for checkout." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify({
        email: auth.user.email,
        amount: amountMinor,
        currency: paygConfig.currency,
        reference,
        callback_url: callbackUrl,
        metadata: {
          listing_id: listingId,
          owner_id: listing.owner_id,
          purpose: "listing_submission",
          idempotency_key: paymentIdempotency,
          mode: config.mode,
          provider: "paystack",
        },
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

    const now = new Date().toISOString();
    const { error: insertError } = await adminClient.from("listing_payments").insert({
      user_id: listing.owner_id,
      listing_id: listingId,
      amount: paygConfig.amount,
      currency: paygConfig.currency,
      status: "pending",
      provider: "paystack",
      provider_ref: payload?.data?.reference || reference,
      idempotency_key: paymentIdempotency,
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        level: "warn",
        error: insertError.message,
      });
      return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
    }

    const sessionKey = resolveEventSessionKey({ request, userId: auth.user.id });
    await logPropertyEvent({
      supabase,
      propertyId: listingId,
      eventType: "listing_payment_started",
      actorUserId: auth.user.id,
      actorRole: role ?? null,
      sessionKey,
      meta: { provider: "paystack", amount: paygConfig.amount, currency: paygConfig.currency },
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: payload.data.authorization_url,
      reference: payload.data.reference || reference,
      amount: paygConfig.amount,
      currency: paygConfig.currency,
      idempotencyKey: paymentIdempotency,
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
