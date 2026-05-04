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
import { getFeaturedConfig } from "@/lib/billing/featured";
import { loadCanadaRentalPaygRuntimeDecision } from "@/lib/billing/canada-payg-runtime.server";
import { getSiteUrl } from "@/lib/env";
import { logFailure } from "@/lib/observability";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";
import { buildHostPropertyEditHref } from "@/lib/routing/dashboard-properties-legacy";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/billing/checkout";

const payloadSchema = z.object({
  listingId: z.string().uuid(),
  purpose: z.enum(["listing_submission", "featured_listing"]),
  idempotencyKey: z.string().min(8).optional(),
});

type CheckoutListingRow = {
  id: string;
  owner_id: string;
  status?: string | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  is_demo?: boolean | null;
  country_code?: string | null;
  listing_intent?: string | null;
  rental_type?: string | null;
};

export type BillingCheckoutRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  getListingAccessResult: typeof getListingAccessResult;
  hasActiveDelegation: typeof hasActiveDelegation;
  getProviderModes: typeof getProviderModes;
  getPaystackConfig: typeof getPaystackConfig;
  getPaygConfig: typeof getPaygConfig;
  getFeaturedConfig: typeof getFeaturedConfig;
  getSiteUrl: typeof getSiteUrl;
  logFailure: typeof logFailure;
  logPropertyEvent: typeof logPropertyEvent;
  resolveEventSessionKey: typeof resolveEventSessionKey;
  loadCanadaRentalPaygRuntimeDecision: typeof loadCanadaRentalPaygRuntimeDecision;
  fetchImplementation: typeof fetch;
};

const defaultDeps: BillingCheckoutRouteDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireUser,
  getUserRole,
  getListingAccessResult,
  hasActiveDelegation,
  getProviderModes,
  getPaystackConfig,
  getPaygConfig,
  getFeaturedConfig,
  getSiteUrl,
  logFailure,
  logPropertyEvent,
  resolveEventSessionKey,
  loadCanadaRentalPaygRuntimeDecision,
  fetchImplementation: fetch,
};

export async function postBillingCheckoutResponse(
  request: Request,
  deps: BillingCheckoutRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
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

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { listingId, idempotencyKey, purpose } = parsed.data;
  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const lookupClient = adminClient;

  const { data: listing, error: listingError } = await lookupClient
    .from("properties")
    .select("id, owner_id, status, is_featured, featured_until, is_demo, country_code, listing_intent, rental_type")
    .eq("id", listingId)
    .maybeSingle();

  const typedListing = listing as CheckoutListingRow | null;
  if (listingError || !typedListing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (purpose === "listing_submission") {
    if (typedListing.status === "pending" || typedListing.status === "live") {
      return NextResponse.json({ error: "Listing already submitted." }, { status: 409 });
    }
  } else {
    const nowMs = Date.now();
    const featuredUntilMs = typedListing.featured_until ? Date.parse(typedListing.featured_until) : null;
    const featuredActive =
      !!typedListing.is_featured && (!featuredUntilMs || (Number.isFinite(featuredUntilMs) && featuredUntilMs > nowMs));
    if (typedListing.status !== "live") {
      return NextResponse.json({ error: "Listing must be live to feature." }, { status: 409 });
    }
    if (typedListing.is_demo) {
      return NextResponse.json({ error: "Demo listings can't be featured." }, { status: 409 });
    }
    if (featuredActive) {
      return NextResponse.json({ error: "Listing is already featured." }, { status: 409 });
    }
  }

  const ownership = requireOwnership({
    request,
    route: routeLabel,
    startTime,
    resourceOwnerId: typedListing.owner_id,
    userId: auth.user.id,
    role,
    allowRoles: ["admin"],
  });
  if (!ownership.ok) {
    if (role === "agent") {
      const allowed = await deps.hasActiveDelegation(supabase, auth.user.id, typedListing.owner_id);
      if (!allowed) return ownership.response;
    } else {
      return ownership.response;
    }
  }

  if (purpose === "listing_submission" && typedListing.country_code?.toUpperCase() === "CA") {
    const canadaDecision = await deps.loadCanadaRentalPaygRuntimeDecision({
      serviceClient: adminClient,
      ownerId: typedListing.owner_id,
      listingId,
      marketCountry: typedListing.country_code,
      listingIntent: typedListing.listing_intent,
      rentalType: typedListing.rental_type,
    });

    if (!canadaDecision.gateEnabled) {
      return NextResponse.json(
        {
          error: "Canada rental PAYG runtime is disabled.",
          code: "CANADA_PAYG_RUNTIME_DISABLED",
          reasonCode: canadaDecision.readiness.reasonCode,
          runtimeActivationAllowed: false,
          checkoutEnabled: false,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Canada rental PAYG checkout is not enabled in this batch.",
        code: canadaDecision.readiness.runtimeActivationAllowed
          ? "CANADA_PAYG_CHECKOUT_DISABLED"
          : "CANADA_PAYG_NOT_READY",
        reasonCode: canadaDecision.readiness.reasonCode,
        runtimeActivationAllowed: canadaDecision.readiness.runtimeActivationAllowed,
        checkoutEnabled: false,
      },
      { status: 409 }
    );
  }

  const paygConfig = await deps.getPaygConfig();
  const featuredConfig = await deps.getFeaturedConfig();
  if (!paygConfig.enabled && purpose === "listing_submission") {
    return NextResponse.json({ error: "PAYG is disabled." }, { status: 409 });
  }

  const { paystackMode } = await deps.getProviderModes();
  const config = await deps.getPaystackConfig(paystackMode);
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
  const amount = purpose === "listing_submission" ? paygConfig.amount : featuredConfig.paygAmount;
  const currency = purpose === "listing_submission" ? paygConfig.currency : featuredConfig.currency;
  const amountMinor = Math.round(amount * 100);
  const baseUrl = await deps.getSiteUrl();
  const callbackUrl =
    purpose === "listing_submission"
      ? `${baseUrl}${buildHostPropertyEditHref(listingId, { payment: "payg" })}`
      : `${baseUrl}/host?featured=${listingId}`;
  const paymentIdempotency = idempotencyKey || crypto.randomUUID();

  if (!auth.user.email) {
    return NextResponse.json({ error: "Account email is required for checkout." }, { status: 400 });
  }

  try {
    const response = await deps.fetchImplementation("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify({
        email: auth.user.email,
        amount: amountMinor,
        currency,
        reference,
        callback_url: callbackUrl,
        metadata: {
          listing_id: listingId,
          owner_id: typedListing.owner_id,
          purpose,
          idempotency_key: paymentIdempotency,
          mode: config.mode,
          provider: "paystack",
        },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
      deps.logFailure({
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
    const paymentsTable = purpose === "listing_submission" ? "listing_payments" : "feature_purchases";
    const payloadInsert = {
      user_id: typedListing.owner_id,
      listing_id: listingId,
      amount,
      currency,
      status: "pending",
      provider: "paystack",
      provider_ref: payload?.data?.reference || reference,
      idempotency_key: paymentIdempotency,
      created_at: now,
      updated_at: now,
    };
    const { error: insertError } = await adminClient.from(paymentsTable).insert(payloadInsert);

    if (insertError) {
      deps.logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        level: "warn",
        error: insertError.message,
      });
      return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
    }

    const sessionKey = deps.resolveEventSessionKey({ request, userId: auth.user.id });
    await deps.logPropertyEvent({
      supabase,
      propertyId: listingId,
      eventType: "listing_payment_started",
      actorUserId: auth.user.id,
      actorRole: role ?? null,
      sessionKey,
      meta: { provider: "paystack", amount, currency, purpose },
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: payload.data.authorization_url,
      reference: payload.data.reference || reference,
      amount,
      currency,
      idempotencyKey: paymentIdempotency,
      purpose,
    });
  } catch (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Paystack request failed." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return postBillingCheckoutResponse(request);
}
