import crypto from "node:crypto";
import { getSiteUrl } from "@/lib/env";
import { buildFeaturedReceiptEmail } from "@/lib/email/templates/receipt-featured";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

type PaymentRow = {
  id: string;
  amount_minor: number;
  currency: string;
  email: string | null;
  reference: string;
  receipt_sent_at: string | null;
};

type WebhookEventInsertResult = {
  id: string | null;
  duplicate: boolean;
};

function parseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function parseErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

export function hashWebhookPayload(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

export async function insertPaymentWebhookEvent(input: {
  client: UntypedAdminClient;
  provider: "paystack";
  event: string | null;
  reference: string | null;
  signature: string | null;
  payload: Record<string, unknown>;
  payloadHash: string;
}) : Promise<WebhookEventInsertResult> {
  const { data, error } = await input.client
    .from("payment_webhook_events")
    .insert({
      provider: input.provider,
      event: input.event,
      reference: input.reference,
      signature: input.signature,
      payload: input.payload,
      payload_hash: input.payloadHash,
      processed: false,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    const code = parseErrorCode(error);
    if (code === "23505") {
      return { id: null, duplicate: true };
    }
    throw new Error(parseErrorMessage(error) || "Unable to record webhook event.");
  }

  return {
    id: typeof (data as { id?: unknown } | null)?.id === "string" ? (data as { id: string }).id : null,
    duplicate: false,
  };
}

export async function markPaymentWebhookEventProcessed(input: {
  client: UntypedAdminClient;
  id: string;
}) {
  await input.client
    .from("payment_webhook_events")
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      process_error: null,
    })
    .eq("id", input.id);
}

export async function markPaymentWebhookEventError(input: {
  client: UntypedAdminClient;
  id: string;
  error: string;
}) {
  await input.client
    .from("payment_webhook_events")
    .update({
      processed: false,
      processed_at: null,
      process_error: input.error,
    })
    .eq("id", input.id);
}

export async function fetchPaymentWebhookEvents(input: {
  client: UntypedAdminClient;
  limit?: number;
  reference?: string | null;
}) {
  const limit = Number.isFinite(input.limit || NaN)
    ? Math.max(1, Math.min(200, Math.trunc(input.limit || 50)))
    : 50;
  let query = input.client
    .from("payment_webhook_events")
    .select("id,provider,event,reference,processed,processed_at,process_error,received_at")
    .order("received_at", { ascending: false })
    .range(0, limit - 1);

  const ref = String(input.reference || "").trim();
  if (ref) query = query.eq("reference", ref);

  const { data, error } = await query;
  if (error) throw new Error(parseErrorMessage(error) || "Unable to load webhook events.");
  return ((data as Array<Record<string, unknown>> | null) ?? []);
}

async function sendReceiptEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "resend_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
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
  }).catch(() => null);

  if (!response) return { ok: false, error: "resend_request_failed" };
  if (!response.ok) return { ok: false, error: `resend_${response.status}` };
  return { ok: true };
}

export async function sendFeaturedReceiptIfNeeded(input: {
  client: UntypedAdminClient;
  paymentId: string;
  fallbackEmail?: string | null;
}) {
  const { data, error } = await input.client
    .from("payments")
    .select("id,amount_minor,currency,email,reference,receipt_sent_at")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (error || !data) {
    return { sent: false, alreadySent: false, reason: "payment_not_found" as const };
  }

  const payment = data as PaymentRow;
  if (payment.receipt_sent_at) {
    return { sent: false, alreadySent: true, reason: "already_sent" as const };
  }

  const recipient = String(input.fallbackEmail || payment.email || "").trim();
  if (!recipient) {
    return { sent: false, alreadySent: false, reason: "missing_recipient" as const };
  }

  const { data: purchaseData, error: purchaseError } = await input.client
    .from("featured_purchases")
    .select("plan,properties(title,address,city)")
    .eq("payment_id", payment.id)
    .maybeSingle();

  if (purchaseError || !purchaseData) {
    return { sent: false, alreadySent: false, reason: "purchase_not_found" as const };
  }

  const purchase = purchaseData as {
    plan?: string | null;
    properties?: { title?: string | null; address?: string | null; city?: string | null } | null;
  };

  const siteUrl = await getSiteUrl();
  const receipt = buildFeaturedReceiptEmail({
    amountMinor: payment.amount_minor,
    currency: payment.currency,
    plan: purchase.plan === "featured_30d" ? "featured_30d" : "featured_7d",
    reference: payment.reference,
    paidAtIso: null,
    propertyTitle: purchase.properties?.title || "Listing",
    propertyAddress: purchase.properties?.address || null,
    propertyCity: purchase.properties?.city || null,
    siteUrl,
  });

  const sendResult = await sendReceiptEmail({
    to: recipient,
    subject: receipt.subject,
    html: receipt.html,
  });

  if (!sendResult.ok) {
    return { sent: false, alreadySent: false, reason: sendResult.error as string };
  }

  await input.client
    .from("payments")
    .update({
      receipt_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  return { sent: true, alreadySent: false, reason: null };
}
