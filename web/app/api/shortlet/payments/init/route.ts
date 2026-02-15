import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { getSiteUrl } from "@/lib/env";
import {
  buildShortletPaymentReference,
  getPaystackServerConfig,
  hasPaystackServerEnv,
  initializeTransaction,
} from "@/lib/payments/paystack.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/shortlet/payments/init";

const payloadSchema = z.object({
  bookingId: z.string().uuid(),
});

export type InitShortletPaymentDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  hasPaystackServerEnv: typeof hasPaystackServerEnv;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  createServiceRoleClient: typeof createServiceRoleClient;
  buildShortletPaymentReference: typeof buildShortletPaymentReference;
  initializeTransaction: typeof initializeTransaction;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  getSiteUrl: typeof getSiteUrl;
};

const defaultDeps: InitShortletPaymentDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  hasPaystackServerEnv,
  requireUser,
  getUserRole,
  createServiceRoleClient,
  buildShortletPaymentReference,
  initializeTransaction,
  getPaystackServerConfig,
  getSiteUrl,
};

type PaymentStatus = "initiated" | "authorised" | "captured" | "voided" | "failed" | "refunded";

function asStatus(value: unknown): PaymentStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "initiated" ||
    normalized === "authorised" ||
    normalized === "captured" ||
    normalized === "voided" ||
    normalized === "failed" ||
    normalized === "refunded"
  ) {
    return normalized;
  }
  return "failed";
}

function asInt(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

export async function postShortletPaymentInitResponse(
  request: NextRequest,
  deps: InitShortletPaymentDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 503 });
  }
  if (!deps.hasPaystackServerEnv()) {
    return NextResponse.json({ error: "Paystack is not configured." }, { status: 503 });
  }

  const auth = await deps.requireUser({
    request,
    route: routeLabel,
    startTime,
  });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(auth.supabase, auth.user.id);
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 422 });
  }

  const payerEmail = String(auth.user.email || "").trim();
  if (!payerEmail) {
    return NextResponse.json({ error: "Account email is required for checkout." }, { status: 400 });
  }

  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const { bookingId } = parsed.data;

  const { data: bookingData, error: bookingError } = await adminClient
    .from("shortlet_bookings")
    .select("id,guest_user_id,status,total_amount_minor,total_price_minor,currency,payment_reference,property_id")
    .eq("id", bookingId)
    .maybeSingle();

  const booking = (bookingData as Record<string, unknown> | null) ?? null;
  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const guestUserId = String(booking.guest_user_id || "");
  const bookingStatus = String(booking.status || "");
  if (role !== "admin" && guestUserId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (bookingStatus !== "pending" && bookingStatus !== "confirmed") {
    return NextResponse.json({ error: "Booking is not eligible for checkout." }, { status: 409 });
  }

  const amountMinor = asInt(booking.total_price_minor ?? booking.total_amount_minor);
  const currency = String(booking.currency || "NGN").toUpperCase();
  if (amountMinor <= 0) {
    return NextResponse.json({ error: "Booking total is unavailable for checkout." }, { status: 409 });
  }
  if (currency !== "NGN") {
    return NextResponse.json(
      { error: "Shortlet checkout currently supports NGN only." },
      { status: 409 }
    );
  }

  const { data: existingData, error: existingError } = await adminClient
    .from("shortlet_payments")
    .select("id,status,reference,access_code")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: "Unable to prepare payment." }, { status: 500 });
  }

  const existingPayment = (existingData as Record<string, unknown> | null) ?? null;
  const existingStatus = asStatus(existingPayment?.status);
  const paystackConfig = deps.getPaystackServerConfig();
  const publicKey = String(paystackConfig.publicKey || "").trim() || null;

  if (existingPayment && (existingStatus === "initiated" || existingStatus === "authorised")) {
    return NextResponse.json({
      ok: true,
      bookingId,
      paymentId: String(existingPayment.id || ""),
      reference: String(existingPayment.reference || ""),
      access_code: String(existingPayment.access_code || ""),
      amount_minor: amountMinor,
      currency,
      status: existingStatus,
      reused: true,
      paystack_public_key: publicKey,
      payer_email: payerEmail,
    });
  }

  if (existingPayment && existingStatus === "captured") {
    return NextResponse.json({ error: "Payment already captured for this booking." }, { status: 409 });
  }

  const siteUrl = await deps.getSiteUrl();
  const reference = deps.buildShortletPaymentReference(bookingId);
  const callbackUrl = `${siteUrl}/tenant/bookings?booking=${encodeURIComponent(bookingId)}`;

  const initialized = await deps.initializeTransaction({
    secretKey: paystackConfig.secretKey || undefined,
    amount_minor: amountMinor,
    email: payerEmail,
    reference,
    callback_url: callbackUrl,
    metadata: {
      booking_id: bookingId,
      property_id: String(booking.property_id || ""),
      flow: "shortlet_booking",
      source: routeLabel,
    },
    currency: "NGN",
  });

  const meta = {
    callback_url: callbackUrl,
    initialized_at: new Date().toISOString(),
    provider_response_reference: initialized.reference,
  };

  if (existingPayment) {
    const { error: updateError } = await adminClient
      .from("shortlet_payments")
      .update({
        status: "initiated",
        amount_minor: amountMinor,
        currency: "NGN",
        reference,
        access_code: initialized.accessCode,
        paid_at: null,
        captured_at: null,
        meta,
      })
      .eq("id", String(existingPayment.id || ""));

    if (updateError) {
      return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
    }
  } else {
    const { error: insertError } = await adminClient.from("shortlet_payments").insert({
      booking_id: bookingId,
      provider: "paystack",
      status: "initiated",
      currency: "NGN",
      amount_minor: amountMinor,
      reference,
      access_code: initialized.accessCode,
      meta,
    });
    if (insertError) {
      return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
    }
  }

  await adminClient
    .from("shortlet_bookings")
    .update({
      payment_reference: reference,
    })
    .eq("id", bookingId);

  return NextResponse.json({
    ok: true,
    bookingId,
    reference,
    access_code: initialized.accessCode,
    amount_minor: amountMinor,
    currency: "NGN",
    status: "initiated",
    reused: false,
    paystack_public_key: publicKey,
    payer_email: payerEmail,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await postShortletPaymentInitResponse(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initialize checkout." },
      { status: 502 }
    );
  }
}
