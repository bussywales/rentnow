import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import {
  getPaymentWithPurchaseByReference,
  type PaymentRow,
} from "@/lib/payments/featured-payments.server";
import { sendFeaturedReceiptIfNeeded } from "@/lib/payments/featured-payments-ops.server";
import { verifyTransaction } from "@/lib/payments/paystack.server";

export type PaymentsReconcileMode = "batch" | "stuck" | "receipts";

type CandidatePaymentRow = {
  id: string;
  provider: string;
  status: string;
  reference: string | null;
  created_at: string;
  receipt_sent_at: string | null;
};

export type PaymentsReconcileSummary = {
  scanned: number;
  reconciled: number;
  activated: number;
  receiptsSent: number;
  alreadyActivated: number;
  receiptAlreadySent: number;
  verifyFailedCount: number;
  errorCount: number;
  errors: string[];
};

type ReconcileByReferenceInput = {
  client: UntypedAdminClient;
  reference: string;
  secretKey: string;
  ensureMissingPaymentFromVerify?: boolean;
  verifyTransactionFn?: typeof verifyTransaction;
  getPaymentWithPurchaseByReferenceFn?: typeof getPaymentWithPurchaseByReference;
  sendFeaturedReceiptIfNeededFn?: typeof sendFeaturedReceiptIfNeeded;
};

export type ReconcileByReferenceResult = {
  ok: boolean;
  reason: string;
  paymentStatus: string | null;
  activated: boolean;
  alreadyActivated: boolean;
  receiptSent: boolean;
  receiptAlreadySent: boolean;
  verifyFailed: boolean;
};

function parseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function parseErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown_error";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : "unknown_error";
}

function readMetadataValue(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - Math.max(0, Math.trunc(minutes)) * 60_000).toISOString();
}

async function ensurePaymentExistsFromVerifiedTransaction(input: {
  client: UntypedAdminClient;
  reference: string;
  verified: Awaited<ReturnType<typeof verifyTransaction>>;
}): Promise<string | null> {
  const dataRecord =
    input.verified.raw && typeof input.verified.raw === "object"
      ? ((input.verified.raw as { data?: unknown }).data as Record<string, unknown> | undefined)
      : undefined;
  const metadata = dataRecord?.metadata;

  const propertyId = readMetadataValue(metadata, "property_id");
  if (!propertyId) return null;

  const { data: propertyData, error: propertyError } = await input.client
    .from("properties")
    .select("id,owner_id")
    .eq("id", propertyId)
    .maybeSingle();

  const property = (propertyData as { id?: string; owner_id?: string } | null) ?? null;
  if (propertyError || !property?.id || !property.owner_id) return null;

  const plan = readMetadataValue(metadata, "plan") === "featured_30d" ? "featured_30d" : "featured_7d";
  const requestId = readMetadataValue(metadata, "request_id");
  const durationDays = plan === "featured_30d" ? 30 : 7;
  const nowIso = new Date().toISOString();

  const { data: insertedPayment, error: paymentError } = await input.client
    .from("payments")
    .insert({
      user_id: property.owner_id,
      provider: "paystack",
      status: "succeeded",
      currency: input.verified.currency || "NGN",
      amount_minor: Math.max(0, Math.trunc(input.verified.amountMinor || 0)),
      email: input.verified.email || null,
      reference: input.reference,
      authorization_code: input.verified.authorizationCode,
      paid_at: input.verified.paidAt || nowIso,
      meta: {
        source: "reconcile",
        paystack_status: input.verified.status,
      },
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  if (paymentError) {
    const code = parseErrorCode(paymentError);
    if (code === "23505") {
      const { data: existingData } = await input.client
        .from("payments")
        .select("id")
        .eq("reference", input.reference)
        .maybeSingle();
      const existingId = (existingData as { id?: string } | null)?.id ?? null;
      return existingId;
    }
    return null;
  }

  const paymentId = (insertedPayment as { id?: string } | null)?.id ?? null;
  if (!paymentId) return null;

  await input.client
    .from("featured_purchases")
    .insert({
      payment_id: paymentId,
      property_id: property.id,
      request_id: requestId,
      plan,
      duration_days: durationDays,
      status: "pending",
      created_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  return paymentId;
}

async function activateFeaturedPurchase(input: { client: UntypedAdminClient; paymentId: string }) {
  const rpcClient = input.client as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  return rpcClient.rpc("activate_featured_purchase", {
    p_payment_id: input.paymentId,
  });
}

async function fetchCandidatePayments(input: {
  client: UntypedAdminClient;
  mode: PaymentsReconcileMode;
  limit: number;
}) {
  const thresholdIso = minutesAgoIso(input.mode === "stuck" ? 30 : 2);
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(input.limit || 50)));

  const baseColumns = "id,provider,status,reference,created_at,receipt_sent_at";

  const pendingStatuses = ["initialized", "initiated", "pending"];

  const fetchPending = async (limit: number) => {
    const { data, error } = await input.client
      .from("payments")
      .select(baseColumns)
      .eq("provider", "paystack")
      .in("status", pendingStatuses)
      .not("reference", "is", null)
      .lte("created_at", thresholdIso)
      .order("created_at", { ascending: true })
      .range(0, Math.max(0, limit - 1));
    if (error) throw new Error(parseErrorMessage(error));
    return (data as CandidatePaymentRow[] | null) ?? [];
  };

  const fetchReceipts = async (limit: number) => {
    const { data, error } = await input.client
      .from("payments")
      .select(baseColumns)
      .eq("provider", "paystack")
      .eq("status", "succeeded")
      .not("receipt_sent_at", "is", "not.null")
      .not("reference", "is", null)
      .lte("created_at", thresholdIso)
      .order("created_at", { ascending: true })
      .range(0, Math.max(0, limit - 1));
    if (error) throw new Error(parseErrorMessage(error));
    return (data as CandidatePaymentRow[] | null) ?? [];
  };

  if (input.mode === "stuck") {
    return fetchPending(safeLimit);
  }

  if (input.mode === "receipts") {
    return fetchReceipts(safeLimit);
  }

  const [pendingRows, receiptRows] = await Promise.all([
    fetchPending(safeLimit),
    fetchReceipts(safeLimit),
  ]);

  const map = new Map<string, CandidatePaymentRow>();
  for (const row of [...pendingRows, ...receiptRows]) {
    const key = row.reference || row.id;
    if (!map.has(key)) map.set(key, row);
  }

  return [...map.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, safeLimit);
}

export async function reconcilePaystackReference(
  input: ReconcileByReferenceInput
): Promise<ReconcileByReferenceResult> {
  const verifyFn = input.verifyTransactionFn ?? verifyTransaction;
  const getPaymentFn =
    input.getPaymentWithPurchaseByReferenceFn ?? getPaymentWithPurchaseByReference;
  const sendReceiptFn = input.sendFeaturedReceiptIfNeededFn ?? sendFeaturedReceiptIfNeeded;

  let verified: Awaited<ReturnType<typeof verifyTransaction>>;
  try {
    verified = await verifyFn({
      secretKey: input.secretKey,
      reference: input.reference,
    });
  } catch (error) {
    return {
      ok: false,
      reason: parseErrorMessage(error),
      paymentStatus: null,
      activated: false,
      alreadyActivated: false,
      receiptSent: false,
      receiptAlreadySent: false,
      verifyFailed: true,
    };
  }

  if (!verified.ok) {
    return {
      ok: false,
      reason: "verification_failed",
      paymentStatus: verified.status || "failed",
      activated: false,
      alreadyActivated: false,
      receiptSent: false,
      receiptAlreadySent: false,
      verifyFailed: true,
    };
  }

  let bundle = await getPaymentFn({ client: input.client, reference: input.reference });
  if (!bundle && input.ensureMissingPaymentFromVerify) {
    await ensurePaymentExistsFromVerifiedTransaction({
      client: input.client,
      reference: input.reference,
      verified,
    });
    bundle = await getPaymentFn({ client: input.client, reference: input.reference });
  }

  if (!bundle) {
    return {
      ok: false,
      reason: "payment_not_found",
      paymentStatus: null,
      activated: false,
      alreadyActivated: false,
      receiptSent: false,
      receiptAlreadySent: false,
      verifyFailed: false,
    };
  }

  const payment = bundle.payment as PaymentRow;
  const wasAlreadyActivated = bundle.purchase?.status === "activated";
  const paidAt = verified.paidAt || payment.paid_at || new Date().toISOString();
  const paymentMeta = payment.meta && typeof payment.meta === "object" ? payment.meta : {};

  await input.client
    .from("payments")
    .update({
      status: "succeeded",
      paid_at: paidAt,
      authorization_code: verified.authorizationCode || payment.authorization_code,
      email: verified.email || payment.email,
      updated_at: new Date().toISOString(),
      meta: {
        ...paymentMeta,
        source: "reconcile",
      },
    })
    .eq("id", payment.id);

  const activation = await activateFeaturedPurchase({
    client: input.client,
    paymentId: payment.id,
  });
  if (activation.error) {
    return {
      ok: false,
      reason: activation.error.message || "activation_failed",
      paymentStatus: "succeeded",
      activated: false,
      alreadyActivated: wasAlreadyActivated,
      receiptSent: false,
      receiptAlreadySent: false,
      verifyFailed: false,
    };
  }

  const refreshed = await getPaymentFn({ client: input.client, reference: input.reference });
  const isActivated = refreshed?.purchase?.status === "activated";

  const receiptResult = await sendReceiptFn({
    client: input.client,
    paymentId: payment.id,
    fallbackEmail: verified.email || payment.email,
  });

  return {
    ok: true,
    reason: "reconciled",
    paymentStatus: refreshed?.payment?.status || "succeeded",
    activated: !wasAlreadyActivated && isActivated,
    alreadyActivated: wasAlreadyActivated,
    receiptSent: receiptResult.sent,
    receiptAlreadySent: receiptResult.alreadySent,
    verifyFailed: false,
  };
}

export async function runPaymentsReconcileBatch(input: {
  client: UntypedAdminClient;
  secretKey: string;
  mode: PaymentsReconcileMode;
  limit?: number;
  ensureMissingPaymentFromVerify?: boolean;
}) {
  const errors: string[] = [];
  const summary: PaymentsReconcileSummary = {
    scanned: 0,
    reconciled: 0,
    activated: 0,
    receiptsSent: 0,
    alreadyActivated: 0,
    receiptAlreadySent: 0,
    verifyFailedCount: 0,
    errorCount: 0,
    errors,
  };

  const candidates = await fetchCandidatePayments({
    client: input.client,
    mode: input.mode,
    limit: input.limit ?? 50,
  });

  summary.scanned = candidates.length;

  for (const candidate of candidates) {
    const reference = String(candidate.reference || "").trim();
    if (!reference) continue;

    const result = await reconcilePaystackReference({
      client: input.client,
      reference,
      secretKey: input.secretKey,
      ensureMissingPaymentFromVerify: input.ensureMissingPaymentFromVerify ?? false,
    });

    if (result.ok) {
      summary.reconciled += 1;
      if (result.activated) summary.activated += 1;
      if (result.alreadyActivated) summary.alreadyActivated += 1;
      if (result.receiptSent) summary.receiptsSent += 1;
      if (result.receiptAlreadySent) summary.receiptAlreadySent += 1;
      continue;
    }

    if (result.verifyFailed) summary.verifyFailedCount += 1;
    summary.errorCount += 1;
    if (errors.length < 10) {
      errors.push(`${reference}: ${result.reason}`);
    }
  }

  return summary;
}

export async function fetchPaymentsOpsSnapshot(input: {
  client: UntypedAdminClient;
  stuckLimit?: number;
}) {
  const stuckThresholdIso = minutesAgoIso(30);
  const stuckLimit = Math.max(1, Math.min(50, Math.trunc(input.stuckLimit || 10)));

  const pendingStatuses = ["initialized", "initiated", "pending"];

  const [stuckRowsRaw, receiptsRowsRaw] = await Promise.all([
    input.client
      .from("payments")
      .select(
        "id,user_id,status,currency,amount_minor,reference,created_at,featured_purchases(id,payment_id,property_id,request_id,plan,duration_days,status,featured_until,activated_at,created_at,properties(id,title,city))"
      )
      .eq("provider", "paystack")
      .in("status", pendingStatuses)
      .not("reference", "is", null)
      .lte("created_at", stuckThresholdIso)
      .order("created_at", { ascending: true }),
    input.client
      .from("payments")
      .select("id")
      .eq("provider", "paystack")
      .eq("status", "succeeded")
      .not("receipt_sent_at", "is", "not.null"),
  ]);

  const stuckRows = ((stuckRowsRaw.data as Array<Record<string, unknown>> | null) ?? [])
    .sort((a, b) =>
      String((a as { created_at?: string }).created_at || "").localeCompare(
        String((b as { created_at?: string }).created_at || "")
      )
    )
    .slice(0, stuckLimit)
    .map((row) => {
      const purchase = Array.isArray((row as { featured_purchases?: unknown[] }).featured_purchases)
        ? ((row as { featured_purchases?: Array<Record<string, unknown>> }).featured_purchases?.[0] ?? null)
        : null;
      const property =
        purchase && typeof purchase === "object"
          ? ((purchase as { properties?: Record<string, unknown> | null }).properties ?? null)
          : null;
      return {
        id: String((row as { id?: string }).id || ""),
        reference: String((row as { reference?: string }).reference || ""),
        created_at: String((row as { created_at?: string }).created_at || ""),
        amount_minor: Number((row as { amount_minor?: number }).amount_minor || 0),
        currency: String((row as { currency?: string }).currency || "NGN"),
        user_id: String((row as { user_id?: string }).user_id || ""),
        property_id: String((purchase as { property_id?: string } | null)?.property_id || ""),
        property_title: String((property as { title?: string } | null)?.title || "Listing"),
      };
    });

  return {
    stuckCount: ((stuckRowsRaw.data as Array<unknown> | null) ?? []).length,
    receiptsPendingCount: ((receiptsRowsRaw.data as Array<unknown> | null) ?? []).length,
    stuckRows,
  };
}
