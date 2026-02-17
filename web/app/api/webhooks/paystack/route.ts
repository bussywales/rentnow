import { NextResponse, type NextRequest } from "next/server";
import { getPaymentWithPurchaseByReference } from "@/lib/payments/featured-payments.server";
import {
  hashWebhookPayload,
  insertPaymentWebhookEvent,
  markPaymentWebhookEventError,
  markPaymentWebhookEventProcessed,
  sendFeaturedReceiptIfNeeded,
} from "@/lib/payments/featured-payments-ops.server";
import {
  getPaystackServerConfig,
  hasPaystackServerEnv,
  validateWebhookSignature,
  verifyTransaction,
} from "@/lib/payments/paystack.server";
import { dispatchShortletPaymentSuccess } from "@/lib/shortlet/payment-success.server";
import {
  getShortletPaymentCheckoutContextByBookingId,
  getShortletPaymentByReference,
  markShortletPaymentFailed,
  markShortletPaymentSucceededAndConfirmBooking,
  resolveShortletBookingIdFromPaystackPayload,
  upsertShortletPaymentIntent,
} from "@/lib/shortlet/payments.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";
const routeLabel = "/api/webhooks/paystack";

type PaystackWebhookEvent = {
  event?: string | null;
  data?: {
    reference?: string | null;
  } | null;
};

type PaystackWebhookDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  hasPaystackServerEnv: typeof hasPaystackServerEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  hashWebhookPayload: typeof hashWebhookPayload;
  insertPaymentWebhookEvent: typeof insertPaymentWebhookEvent;
  markPaymentWebhookEventError: typeof markPaymentWebhookEventError;
  markPaymentWebhookEventProcessed: typeof markPaymentWebhookEventProcessed;
  validateWebhookSignature: typeof validateWebhookSignature;
  getPaymentWithPurchaseByReference: typeof getPaymentWithPurchaseByReference;
  verifyTransaction: typeof verifyTransaction;
  sendFeaturedReceiptIfNeeded: typeof sendFeaturedReceiptIfNeeded;
  getShortletPaymentByReference: typeof getShortletPaymentByReference;
  getShortletPaymentCheckoutContextByBookingId: typeof getShortletPaymentCheckoutContextByBookingId;
  resolveShortletBookingIdFromPaystackPayload: typeof resolveShortletBookingIdFromPaystackPayload;
  upsertShortletPaymentIntent: typeof upsertShortletPaymentIntent;
  markShortletPaymentFailed: typeof markShortletPaymentFailed;
  markShortletPaymentSucceededAndConfirmBooking: typeof markShortletPaymentSucceededAndConfirmBooking;
  dispatchShortletPaymentSuccess: typeof dispatchShortletPaymentSuccess;
};

const defaultDeps: PaystackWebhookDeps = {
  hasServiceRoleEnv,
  hasPaystackServerEnv,
  createServiceRoleClient,
  getPaystackServerConfig,
  hashWebhookPayload,
  insertPaymentWebhookEvent,
  markPaymentWebhookEventError,
  markPaymentWebhookEventProcessed,
  validateWebhookSignature,
  getPaymentWithPurchaseByReference,
  verifyTransaction,
  sendFeaturedReceiptIfNeeded,
  getShortletPaymentByReference,
  getShortletPaymentCheckoutContextByBookingId,
  resolveShortletBookingIdFromPaystackPayload,
  upsertShortletPaymentIntent,
  markShortletPaymentFailed,
  markShortletPaymentSucceededAndConfirmBooking,
  dispatchShortletPaymentSuccess,
};

export async function postPaystackWebhookResponse(
  request: NextRequest,
  deps: PaystackWebhookDeps = defaultDeps
) {
  console.log(`[${routeLabel}] start`);
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 503 });
  }
  if (!deps.hasPaystackServerEnv()) {
    return NextResponse.json({ error: "Paystack not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const paystackConfig = deps.getPaystackServerConfig();
  const payloadHash = deps.hashWebhookPayload(rawBody);

  let payload: Record<string, unknown> = {};
  let parsedEvent: PaystackWebhookEvent | null = null;
  try {
    parsedEvent = JSON.parse(rawBody) as PaystackWebhookEvent;
    payload = parsedEvent as unknown as Record<string, unknown>;
  } catch {
    payload = {
      parse_error: "invalid_json",
      raw_body: rawBody,
    };
  }

  const eventValue = String(parsedEvent?.event || "").trim().toLowerCase() || null;
  const referenceValue = String(parsedEvent?.data?.reference || "").trim() || null;
  const client = deps.createServiceRoleClient() as unknown as UntypedAdminClient;

  let webhookEventId: string | null = null;
  try {
    const inserted = await deps.insertPaymentWebhookEvent({
      client,
      provider: "paystack",
      event: eventValue,
      reference: referenceValue,
      signature: signature || null,
      payload,
      payloadHash,
    });
    webhookEventId = inserted.id;
    if (inserted.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "webhook_insert_failed" },
      { status: 200 }
    );
  }

  const validSignature = deps.validateWebhookSignature({
    rawBody,
    signature,
    secret: paystackConfig.secretKey,
  });
  if (!validSignature) {
    console.error(`[${routeLabel}] invalid_signature`, { hasSignature: Boolean(signature) });
    if (webhookEventId) {
      await deps.markPaymentWebhookEventError({
        client,
        id: webhookEventId,
        error: "invalid_signature",
      });
    }
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (!parsedEvent || !eventValue || !referenceValue) {
    console.error(`[${routeLabel}] invalid_event_payload`, {
      hasParsedEvent: Boolean(parsedEvent),
      event: eventValue,
      reference: referenceValue,
    });
    if (webhookEventId) {
      await deps.markPaymentWebhookEventError({
        client,
        id: webhookEventId,
        error: !parsedEvent ? "invalid_payload_json" : "missing_reference_or_event",
      });
    }
    return NextResponse.json({ ok: true });
  }

  const shortletPayment = await deps.getShortletPaymentByReference({
    provider: "paystack",
    providerReference: referenceValue,
    client: client as unknown as never,
  });
  const mayBeShortletReference = referenceValue.toLowerCase().startsWith("shb_ps_");
  if (shortletPayment || mayBeShortletReference) {
    if (eventValue === "charge.failed") {
      if (shortletPayment && shortletPayment.status !== "succeeded") {
        await deps.markShortletPaymentFailed({
          provider: "paystack",
          providerReference: referenceValue,
          providerPayload: payload,
          client: client as unknown as never,
        });
      }
      if (webhookEventId) {
        await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
      }
      console.log(`[${routeLabel}] shortlet_failed_event_processed`, {
        reference: referenceValue,
        hadPaymentRecord: Boolean(shortletPayment),
      });
      return NextResponse.json({ ok: true, shortlet: true });
    }

    if (eventValue !== "charge.success") {
      if (webhookEventId) {
        await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
      }
      return NextResponse.json({ ok: true, shortlet: true });
    }

    try {
      const verified = await deps.verifyTransaction({
        secretKey: paystackConfig.secretKey || "",
        reference: referenceValue,
      });
      const providerPayload = (verified.raw || payload) as Record<string, unknown>;
      const providerData =
        providerPayload && typeof providerPayload === "object" && providerPayload.data
          ? (providerPayload.data as Record<string, unknown>)
          : {};
      const bookingId =
        shortletPayment?.booking_id ||
        deps.resolveShortletBookingIdFromPaystackPayload({
          reference: referenceValue,
          payload: providerPayload,
        });
      const booking = bookingId
        ? await deps.getShortletPaymentCheckoutContextByBookingId({
            bookingId,
            client: client as unknown as never,
          })
        : null;
      if (!booking) {
        if (webhookEventId) {
          await deps.markPaymentWebhookEventError({
            client,
            id: webhookEventId,
            error: "booking_not_found_for_shortlet_reference",
          });
        }
        console.error(`[${routeLabel}] booking_not_found_for_shortlet_reference`, {
          reference: referenceValue,
          bookingId,
        });
        return NextResponse.json({ ok: true, shortlet: true, status: "booking_not_found" });
      }

      const paymentCurrency = String(verified.currency || booking.currency || "NGN").toUpperCase();
      const paymentAmountMinor = Math.max(0, Math.trunc(Number(verified.amountMinor || 0)));

      if (!verified.ok) {
        await deps.markShortletPaymentFailed({
          provider: "paystack",
          providerReference: referenceValue,
          providerPayload,
          client: client as unknown as never,
        });
        if (webhookEventId) {
          await deps.markPaymentWebhookEventError({
            client,
            id: webhookEventId,
            error: "verification_failed",
          });
        }
        console.error(`[${routeLabel}] shortlet_verification_failed`, {
          bookingId: booking.bookingId,
          reference: referenceValue,
        });
        return NextResponse.json({ ok: true, status: "verification_failed", shortlet: true });
      }

      if (
        paymentAmountMinor !== Number(booking.totalAmountMinor || 0) ||
        paymentCurrency !== String(booking.currency || "").toUpperCase()
      ) {
        await deps.markShortletPaymentFailed({
          provider: "paystack",
          providerReference: referenceValue,
          providerPayload,
          client: client as unknown as never,
        });
        if (webhookEventId) {
          await deps.markPaymentWebhookEventError({
            client,
            id: webhookEventId,
            error: "amount_or_currency_mismatch",
          });
        }
        console.error(`[${routeLabel}] shortlet_amount_or_currency_mismatch`, {
          bookingId: booking.bookingId,
          reference: referenceValue,
          expectedAmountMinor: booking.totalAmountMinor,
          receivedAmountMinor: paymentAmountMinor,
          expectedCurrency: booking.currency,
          receivedCurrency: paymentCurrency,
        });
        return NextResponse.json({ ok: true, status: "mismatch", shortlet: true });
      }

      await deps.upsertShortletPaymentIntent({
        booking,
        provider: "paystack",
        providerReference: referenceValue,
        amountMinor: paymentAmountMinor,
        providerPayload: {
          ...(providerPayload || {}),
          paystack_transaction_id:
            typeof providerData.id === "number" || typeof providerData.id === "string"
              ? String(providerData.id)
              : null,
          gateway_response:
            typeof providerData.gateway_response === "string" ? providerData.gateway_response : null,
          authorization_code:
            typeof (providerData.authorization as Record<string, unknown> | undefined)?.authorization_code ===
            "string"
              ? ((providerData.authorization as Record<string, unknown>).authorization_code as string)
              : null,
        },
        client: client as unknown as never,
      });

      const paid = await deps.markShortletPaymentSucceededAndConfirmBooking({
        provider: "paystack",
        providerReference: referenceValue,
        providerPayload,
        client: client as unknown as never,
      });

      if (!paid.ok) {
        if (webhookEventId) {
          await deps.markPaymentWebhookEventError({
            client,
            id: webhookEventId,
            error: paid.reason,
          });
        }
        return NextResponse.json({ ok: true, shortlet: true, status: paid.reason });
      }

      if (paid.booking.transitioned) {
        await deps.dispatchShortletPaymentSuccess({
          bookingId: paid.booking.bookingId,
          propertyId: paid.booking.propertyId,
          hostUserId: paid.booking.hostUserId,
          guestUserId: paid.booking.guestUserId,
          listingTitle: paid.booking.listingTitle,
          city: paid.booking.city,
          checkIn: paid.booking.checkIn,
          checkOut: paid.booking.checkOut,
          nights: paid.booking.nights,
          amountMinor: paid.booking.totalAmountMinor,
          currency: paid.booking.currency,
          bookingStatus:
            paid.booking.status === "confirmed" || paid.booking.status === "completed"
              ? "confirmed"
              : "pending",
        });
      }

      if (webhookEventId) {
        await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
      }
      console.log(`[${routeLabel}] shortlet_payment_confirmed`, {
        bookingId: paid.booking.bookingId,
        reference: referenceValue,
        transitioned: paid.booking.transitioned,
      });

      return NextResponse.json({
        ok: true,
        shortlet: true,
        idempotent: !paid.booking.transitioned,
      });
    } catch (error) {
      if (webhookEventId) {
        await deps.markPaymentWebhookEventError({
          client,
          id: webhookEventId,
          error: error instanceof Error ? error.message : "shortlet_webhook_error",
        });
      }
      console.error(`[${routeLabel}] shortlet_webhook_error`, {
        reference: referenceValue,
        error: error instanceof Error ? error.message : "shortlet_webhook_error",
      });
      return NextResponse.json({ ok: false, error: "shortlet_webhook_error" }, { status: 200 });
    }
  }

  const found = await deps.getPaymentWithPurchaseByReference({
    client,
    reference: referenceValue,
  });

  if (!found) {
    if (webhookEventId) {
      await deps.markPaymentWebhookEventError({
        client,
        id: webhookEventId,
        error: "payment_not_found",
      });
    }
    console.log(`[${routeLabel}] no_matching_payment_reference`, { reference: referenceValue });
    return NextResponse.json({ ok: true });
  }

  const { payment } = found;
  if (payment.provider !== "paystack") {
    if (webhookEventId) {
      await deps.markPaymentWebhookEventError({
        client,
        id: webhookEventId,
        error: "provider_mismatch",
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (eventValue === "charge.failed") {
    if (payment.status !== "succeeded") {
      await client
        .from("payments")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
    }
    if (webhookEventId) {
      await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
    }
    console.log(`[${routeLabel}] featured_webhook_processed`, {
      reference: referenceValue,
      event: eventValue,
    });
    return NextResponse.json({ ok: true });
  }

  if (eventValue !== "charge.success") {
    if (webhookEventId) {
      await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
    }
    return NextResponse.json({ ok: true });
  }

  if (payment.status === "succeeded" && found.purchase?.status === "activated") {
    await deps.sendFeaturedReceiptIfNeeded({
      client,
      paymentId: payment.id,
    });
    if (webhookEventId) {
      await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
    }
    return NextResponse.json({ ok: true, idempotent: true });
  }

  try {
    const verified = await deps.verifyTransaction({
      secretKey: paystackConfig.secretKey || "",
      reference: referenceValue,
    });

    if (!verified.ok) {
      await client
        .from("payments")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
      if (webhookEventId) {
        await deps.markPaymentWebhookEventError({
          client,
          id: webhookEventId,
          error: "verification_failed",
        });
      }
      return NextResponse.json({ ok: true, status: "verification_failed" });
    }

    const paidAt = verified.paidAt || new Date().toISOString();
    await client
      .from("payments")
      .update({
        status: "succeeded",
        paid_at: paidAt,
        authorization_code: verified.authorizationCode,
        email: verified.email || payment.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    const rpcClient = client as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
    const { error: activateError } = await rpcClient.rpc("activate_featured_purchase", {
      p_payment_id: payment.id,
    });

    if (activateError) {
      if (webhookEventId) {
        await deps.markPaymentWebhookEventError({
          client,
          id: webhookEventId,
          error: activateError.message || "activate_failed",
        });
      }
      return NextResponse.json({ ok: true, status: "activation_failed" });
    }

    await deps.sendFeaturedReceiptIfNeeded({
      client,
      paymentId: payment.id,
      fallbackEmail: verified.email || payment.email,
    });

    if (webhookEventId) {
      await deps.markPaymentWebhookEventProcessed({ client, id: webhookEventId });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (webhookEventId) {
      await deps.markPaymentWebhookEventError({
        client,
        id: webhookEventId,
        error: error instanceof Error ? error.message : "webhook_error",
      });
    }
    console.error(`[${routeLabel}] featured_webhook_error`, {
      reference: referenceValue,
      error: error instanceof Error ? error.message : "webhook_error",
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "webhook_error" },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postPaystackWebhookResponse(request);
}
