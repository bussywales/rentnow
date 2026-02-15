import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { getPaystackServerConfig, hasPaystackServerEnv, verifyTransaction } from "@/lib/payments/paystack.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/shortlet/payments/verify";

const payloadSchema = z.object({
  reference: z.string().min(6).max(160),
});

export type VerifyShortletPaymentDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  hasPaystackServerEnv: typeof hasPaystackServerEnv;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  createServiceRoleClient: typeof createServiceRoleClient;
  verifyTransaction: typeof verifyTransaction;
  getPaystackServerConfig: typeof getPaystackServerConfig;
};

const defaultDeps: VerifyShortletPaymentDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  hasPaystackServerEnv,
  requireUser,
  getUserRole,
  createServiceRoleClient,
  verifyTransaction,
  getPaystackServerConfig,
};

function sanitizeReference(value: string) {
  return value.trim();
}

export async function postShortletPaymentVerifyResponse(
  request: NextRequest,
  deps: VerifyShortletPaymentDeps = defaultDeps
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
  const reference = sanitizeReference(parsed.data.reference);

  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const { data: paymentData, error: paymentError } = await adminClient
    .from("shortlet_payments")
    .select(
      "id,booking_id,status,currency,amount_minor,reference,shortlet_bookings!inner(id,guest_user_id,status)"
    )
    .eq("reference", reference)
    .maybeSingle();

  const payment = (paymentData as Record<string, unknown> | null) ?? null;
  if (paymentError || !payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const booking = (payment.shortlet_bookings ?? null) as Record<string, unknown> | null;
  const guestUserId = String(booking?.guest_user_id || "");
  if (role !== "admin" && guestUserId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentStatus = String(payment.status || "").toLowerCase();
  if (currentStatus === "captured" || currentStatus === "authorised") {
    return NextResponse.json({
      ok: true,
      bookingId: String(payment.booking_id || ""),
      paymentStatus: currentStatus,
      bookingStatus: String(booking?.status || ""),
      reference,
      alreadyVerified: true,
    });
  }

  const paystackConfig = deps.getPaystackServerConfig();
  const verified = await deps.verifyTransaction({
    secretKey: paystackConfig.secretKey || undefined,
    reference,
  });

  if (!verified.ok) {
    await adminClient
      .from("shortlet_payments")
      .update({
        status: "failed",
        meta: {
          verify_status: verified.status,
          verify_checked_at: new Date().toISOString(),
          raw: verified.raw,
        },
      })
      .eq("id", String(payment.id || ""));

    return NextResponse.json(
      { error: "Payment is not yet successful. Please complete checkout and retry verification." },
      { status: 409 }
    );
  }

  const amountMinor = Number(payment.amount_minor || 0);
  const currency = String(payment.currency || "NGN").toUpperCase();
  if (verified.amountMinor !== amountMinor || String(verified.currency || "").toUpperCase() !== currency) {
    await adminClient
      .from("shortlet_payments")
      .update({
        status: "failed",
        meta: {
          reason: "amount_or_currency_mismatch",
          expected_amount_minor: amountMinor,
          expected_currency: currency,
          provider_amount_minor: verified.amountMinor,
          provider_currency: verified.currency,
          verify_checked_at: new Date().toISOString(),
          raw: verified.raw,
        },
      })
      .eq("id", String(payment.id || ""));
    return NextResponse.json({ error: "Payment verification mismatch." }, { status: 409 });
  }

  const { error: updateError } = await adminClient
    .from("shortlet_payments")
    .update({
      status: "authorised",
      paid_at: verified.paidAt || new Date().toISOString(),
      authorization_code: verified.authorizationCode,
      customer_code: verified.customerCode,
      meta: {
        verify_status: verified.status,
        verify_checked_at: new Date().toISOString(),
        raw: verified.raw,
      },
    })
    .eq("id", String(payment.id || ""));

  if (updateError) {
    return NextResponse.json({ error: "Unable to store payment verification." }, { status: 500 });
  }

  await adminClient
    .from("shortlet_bookings")
    .update({ payment_reference: reference })
    .eq("id", String(payment.booking_id || ""));

  return NextResponse.json({
    ok: true,
    bookingId: String(payment.booking_id || ""),
    bookingStatus: String(booking?.status || ""),
    paymentStatus: "authorised",
    reference,
    alreadyVerified: false,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await postShortletPaymentVerifyResponse(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify payment." },
      { status: 502 }
    );
  }
}
