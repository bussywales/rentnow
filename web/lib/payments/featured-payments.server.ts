import crypto from "node:crypto";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type PaymentStatus = "initialized" | "pending" | "succeeded" | "failed" | "cancelled";
export type FeaturedPurchaseStatus = "pending" | "activated" | "void";

export type PaymentRow = {
  id: string;
  user_id: string;
  provider: string;
  status: PaymentStatus;
  currency: string;
  amount_minor: number;
  email: string | null;
  reference: string;
  authorization_code: string | null;
  paid_at: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type FeaturedPurchaseRow = {
  id: string;
  payment_id: string;
  property_id: string;
  request_id: string | null;
  plan: "featured_7d" | "featured_30d";
  duration_days: number;
  status: FeaturedPurchaseStatus;
  featured_until: string | null;
  activated_at: string | null;
  created_at: string;
};

type RawPaymentWithPurchase = PaymentRow & {
  featured_purchases?: FeaturedPurchaseRow[] | null;
};

export function buildFeaturedPaymentReference() {
  return `featpay_${crypto.randomUUID()}`;
}

export function shouldProcessFeaturedChargeSuccess(input: {
  paymentStatus: string | null | undefined;
  purchaseStatus: string | null | undefined;
}) {
  if (input.paymentStatus === "succeeded") return false;
  if (input.purchaseStatus === "activated") return false;
  return true;
}

export async function createFeaturedPaymentRecords(input: {
  client: UntypedAdminClient;
  userId: string;
  email: string | null;
  amountMinor: number;
  currency: string;
  reference: string;
  propertyId: string;
  requestId: string | null;
  plan: "featured_7d" | "featured_30d";
  durationDays: 7 | 30;
  meta?: Record<string, unknown>;
}) {
  const nowIso = new Date().toISOString();
  const { data: paymentData, error: paymentError } = await input.client
    .from("payments")
    .insert({
      user_id: input.userId,
      provider: "paystack",
      status: "initialized",
      currency: input.currency,
      amount_minor: input.amountMinor,
      email: input.email,
      reference: input.reference,
      meta: input.meta || {},
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(
      "id,user_id,provider,status,currency,amount_minor,email,reference,authorization_code,paid_at,meta,created_at,updated_at"
    )
    .maybeSingle();

  if (paymentError || !paymentData) {
    throw new Error(paymentError?.message || "Unable to create payment.");
  }

  const payment = paymentData as PaymentRow;

  const { data: purchaseData, error: purchaseError } = await input.client
    .from("featured_purchases")
    .insert({
      payment_id: payment.id,
      property_id: input.propertyId,
      request_id: input.requestId,
      plan: input.plan,
      duration_days: input.durationDays,
      status: "pending",
      created_at: nowIso,
    })
    .select(
      "id,payment_id,property_id,request_id,plan,duration_days,status,featured_until,activated_at,created_at"
    )
    .maybeSingle();

  if (purchaseError || !purchaseData) {
    throw new Error(purchaseError?.message || "Unable to create featured purchase.");
  }

  return {
    payment,
    purchase: purchaseData as FeaturedPurchaseRow,
  };
}

export async function markPaymentFailed(input: {
  client: UntypedAdminClient;
  paymentId: string;
  errorMessage: string;
}) {
  const nowIso = new Date().toISOString();
  await input.client
    .from("payments")
    .update({
      status: "failed",
      meta: { error: input.errorMessage },
      updated_at: nowIso,
    })
    .eq("id", input.paymentId);
}

export async function getPaymentWithPurchaseByReference(input: {
  client: UntypedAdminClient;
  reference: string;
}) {
  const { data, error } = await input.client
    .from("payments")
    .select(
      "id,user_id,provider,status,currency,amount_minor,email,reference,authorization_code,paid_at,meta,created_at,updated_at,featured_purchases(id,payment_id,property_id,request_id,plan,duration_days,status,featured_until,activated_at,created_at)"
    )
    .eq("reference", input.reference)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load payment.");
  }

  const row = (data as RawPaymentWithPurchase | null) ?? null;
  if (!row) return null;

  return {
    payment: row as PaymentRow,
    purchase: (row.featured_purchases?.[0] as FeaturedPurchaseRow | undefined) || null,
  };
}

export type AdminPaymentsFilters = {
  status?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

export async function fetchAdminPayments(input: {
  client: UntypedAdminClient;
  filters: AdminPaymentsFilters;
}) {
  const limit = Number.isFinite(input.filters.limit || NaN)
    ? Math.max(1, Math.min(500, Math.trunc(input.filters.limit || 100)))
    : 100;

  let query = input.client
    .from("payments")
    .select(
      "id,user_id,status,currency,amount_minor,email,reference,paid_at,created_at,meta,featured_purchases(id,payment_id,property_id,request_id,plan,duration_days,status,featured_until,activated_at,created_at,properties(id,title,city))"
    )
    .eq("provider", "paystack")
    .order("created_at", { ascending: false })
    .range(0, limit - 1);

  const status = String(input.filters.status || "").trim().toLowerCase();
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const from = input.filters.from ? Date.parse(input.filters.from) : NaN;
  if (Number.isFinite(from)) {
    query = query.gte("created_at", new Date(from).toISOString());
  }
  const to = input.filters.to ? Date.parse(input.filters.to) : NaN;
  if (Number.isFinite(to)) {
    query = query.lte("created_at", new Date(to + 24 * 60 * 60 * 1000 - 1).toISOString());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Unable to load payments.");
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []);
}
