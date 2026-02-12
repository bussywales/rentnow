import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/env";
import { buildFeaturedReceiptEmail } from "@/lib/email/templates/receipt-featured";
import { getPaymentWithPurchaseByReference } from "@/lib/payments/featured-payments.server";
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

async function sendReceipt(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "PropatyHub <no-reply@propatyhub.com>",
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  }).catch(() => undefined);
}

async function buildReceiptPayload(input: {
  client: UntypedAdminClient;
  paymentId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  paidAt: string | null;
}) {
  const { data } = await input.client
    .from("featured_purchases")
    .select("plan,property_id,properties(title,address,city)")
    .eq("payment_id", input.paymentId)
    .maybeSingle();

  const row = (data as
    | {
        plan?: "featured_7d" | "featured_30d" | null;
        properties?: { title?: string | null; address?: string | null; city?: string | null } | null;
      }
    | null) ?? null;
  if (!row) return null;

  const siteUrl = await getSiteUrl();
  return buildFeaturedReceiptEmail({
    amountMinor: input.amountMinor,
    currency: input.currency,
    plan: row.plan === "featured_30d" ? "featured_30d" : "featured_7d",
    reference: input.reference,
    paidAtIso: input.paidAt,
    propertyTitle: row.properties?.title || "Listing",
    propertyAddress: row.properties?.address || null,
    propertyCity: row.properties?.city || null,
    siteUrl,
  });
}

export async function POST(request: NextRequest) {
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 503 });
  }
  if (!hasPaystackServerEnv()) {
    return NextResponse.json({ error: "Paystack not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const paystackConfig = getPaystackServerConfig();

  const validSignature = validateWebhookSignature({
    rawBody,
    signature,
    secret: paystackConfig.webhookSecret,
  });
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: PaystackWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const event = String(payload.event || "").trim().toLowerCase();
  if (!event) return NextResponse.json({ ok: true });

  const reference = String(payload.data?.reference || "").trim();
  if (!reference) return NextResponse.json({ ok: true });

  const client = createServiceRoleClient() as unknown as UntypedAdminClient;
  const found = await getPaymentWithPurchaseByReference({
    client,
    reference,
  });

  if (!found) {
    return NextResponse.json({ ok: true });
  }

  const { payment } = found;
  if (payment.provider !== "paystack") {
    return NextResponse.json({ ok: true });
  }

  if (event === "charge.failed") {
    if (payment.status !== "succeeded") {
      await client
        .from("payments")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
    }
    return NextResponse.json({ ok: true });
  }

  if (event !== "charge.success") {
    return NextResponse.json({ ok: true });
  }

  if (payment.status === "succeeded") {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  try {
    const verified = await verifyTransaction({
      secretKey: paystackConfig.secretKey || "",
      reference,
    });

    if (!verified.ok) {
      await client
        .from("payments")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
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

    if (!activateError) {
      const receipt = await buildReceiptPayload({
        client,
        paymentId: payment.id,
        amountMinor: payment.amount_minor,
        currency: payment.currency,
        reference: payment.reference,
        paidAt,
      });
      if (receipt && (verified.email || payment.email)) {
        await sendReceipt({
          to: verified.email || payment.email || "",
          subject: receipt.subject,
          html: receipt.html,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "webhook_error" },
      { status: 200 }
    );
  }
}
