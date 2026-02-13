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
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

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
};

export async function postPaystackWebhookResponse(
  request: NextRequest,
  deps: PaystackWebhookDeps = defaultDeps
) {
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

  const validSignature = validateWebhookSignature({
    rawBody,
    signature,
    secret: paystackConfig.webhookSecret,
  });
  if (!validSignature) {
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
    if (webhookEventId) {
      await deps.markPaymentWebhookEventError({
        client,
        id: webhookEventId,
        error: !parsedEvent ? "invalid_payload_json" : "missing_reference_or_event",
      });
    }
    return NextResponse.json({ ok: true });
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
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "webhook_error" },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postPaystackWebhookResponse(request);
}
