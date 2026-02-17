import { NextResponse, type NextRequest } from "next/server";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import {
  getPaystackServerConfig,
  hasPaystackServerEnv,
  verifyTransaction,
} from "@/lib/payments/paystack.server";
import {
  clearShortletPaymentReconcileState,
  getShortletPaymentCheckoutContextByBookingId,
  isTerminalShortletBookingStatus,
  listShortletPaymentsForReconcile,
  lockShortletPaymentForReconcile,
  markShortletPaymentFailed,
  markShortletPaymentNeedsReconcile,
  markShortletPaymentSucceededAndConfirmBooking,
  type ShortletPaymentReconcileRow,
} from "@/lib/shortlet/payments.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

const routeLabel = "/api/internal/shortlet/reconcile-payments";
const STALE_WINDOW_MS = 5 * 60 * 1000;
const RECONCILE_LOCK_MS = 90 * 1000;
const RECONCILE_RETRY_LOCK_MS = 60 * 1000;
const DEFAULT_LIMIT = 50;
const LEGACY_RECONCILE_SELECT =
  "id,booking_id,provider,provider_reference,status,currency,amount_total_minor,provider_payload_json,created_at,updated_at";
const RECONCILE_SCHEMA_COLUMNS = [
  "needs_reconcile",
  "reconcile_reason",
  "reconcile_locked_until",
  "verify_attempts",
  "last_verified_at",
] as const;

type StripeSessionLike = {
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id?: string | null } | null;
};

export type InternalShortletReconcileDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  hasPaystackServerEnv: typeof hasPaystackServerEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getCronSecret: () => string;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  verifyTransaction: typeof verifyTransaction;
  getProviderModes: typeof getProviderModes;
  getStripeConfigForMode: typeof getStripeConfigForMode;
  getStripeClient: typeof getStripeClient;
  listShortletPaymentsForReconcile: typeof listShortletPaymentsForReconcile;
  lockShortletPaymentForReconcile: typeof lockShortletPaymentForReconcile;
  getShortletPaymentCheckoutContextByBookingId: typeof getShortletPaymentCheckoutContextByBookingId;
  clearShortletPaymentReconcileState: typeof clearShortletPaymentReconcileState;
  markShortletPaymentNeedsReconcile: typeof markShortletPaymentNeedsReconcile;
  markShortletPaymentFailed: typeof markShortletPaymentFailed;
  markShortletPaymentSucceededAndConfirmBooking: typeof markShortletPaymentSucceededAndConfirmBooking;
  detectReconcileSchemaSupport?: (input: {
    client: ReturnType<typeof createServiceRoleClient>;
  }) => Promise<boolean>;
  listShortletPaymentsForReconcileLegacy?: (input: {
    staleBeforeIso: string;
    limit: number;
    client: ReturnType<typeof createServiceRoleClient>;
  }) => Promise<ShortletPaymentReconcileRow[]>;
  now: () => Date;
};

const defaultDeps: InternalShortletReconcileDeps = {
  hasServiceRoleEnv,
  hasPaystackServerEnv,
  createServiceRoleClient,
  getCronSecret: () => process.env.CRON_SECRET || "",
  getPaystackServerConfig,
  verifyTransaction,
  getProviderModes,
  getStripeConfigForMode,
  getStripeClient,
  listShortletPaymentsForReconcile,
  lockShortletPaymentForReconcile,
  getShortletPaymentCheckoutContextByBookingId,
  clearShortletPaymentReconcileState,
  markShortletPaymentNeedsReconcile,
  markShortletPaymentFailed,
  markShortletPaymentSucceededAndConfirmBooking,
  detectReconcileSchemaSupport,
  listShortletPaymentsForReconcileLegacy,
  now: () => new Date(),
};

function hasValidCronSecret(request: NextRequest, expected: string) {
  if (!expected) return false;
  return request.headers.get("x-cron-secret") === expected;
}

function normalizeCurrency(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function shouldMarkProviderFailure(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  return (
    normalized.includes("fail") ||
    normalized.includes("abandon") ||
    normalized.includes("cancel") ||
    normalized.includes("revers") ||
    normalized.includes("declin")
  );
}

function resolveStripeTxId(session: StripeSessionLike) {
  if (typeof session.payment_intent === "string" && session.payment_intent.trim()) {
    return session.payment_intent;
  }
  if (
    session.payment_intent &&
    typeof session.payment_intent === "object" &&
    typeof session.payment_intent.id === "string" &&
    session.payment_intent.id.trim()
  ) {
    return session.payment_intent.id;
  }
  return null;
}

type ReconcileSummary = {
  ok: boolean;
  route: string;
  schemaMode: "reconcile_columns" | "legacy_no_reconcile_columns";
  scanned: number;
  locked: number;
  reconciled: number;
  failedMarked: number;
  skippedLocked: number;
  skippedTerminal: number;
  flaggedForReconcile: number;
  errors: string[];
};

function isMissingColumnErrorMessage(input: { message: string | null | undefined; column: string }) {
  const message = String(input.message || "").toLowerCase();
  const column = input.column.toLowerCase();
  return (
    message.includes("does not exist") &&
    (message.includes(`shortlet_payments.${column}`) ||
      message.includes(`column ${column}`) ||
      message.includes(`column \"${column}\"`))
  );
}

function hasMissingReconcileColumnsError(error: { message?: string | null } | null | undefined) {
  return RECONCILE_SCHEMA_COLUMNS.some((column) =>
    isMissingColumnErrorMessage({
      message: error?.message,
      column,
    })
  );
}

function normalizeLegacyReconcileRow(row: Record<string, unknown>): ShortletPaymentReconcileRow | null {
  const id = String(row.id || "");
  const bookingId = String(row.booking_id || "");
  const providerReference = String(row.provider_reference || "");
  if (!id || !bookingId || !providerReference) return null;

  return {
    id,
    bookingId,
    provider: row.provider === "stripe" ? "stripe" : "paystack",
    providerReference,
    status:
      row.status === "succeeded"
        ? "succeeded"
        : row.status === "failed"
          ? "failed"
          : row.status === "refunded"
            ? "refunded"
            : "initiated",
    currency: String(row.currency || "NGN"),
    amountTotalMinor: Math.max(0, Math.trunc(Number(row.amount_total_minor || 0))),
    verifyAttempts: 0,
    needsReconcile: false,
    reconcileReason: null,
    reconcileLockedUntil: null,
    providerPayload:
      row.provider_payload_json && typeof row.provider_payload_json === "object"
        ? (row.provider_payload_json as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
    lastVerifiedAt: null,
    providerEventId: null,
    providerTxId: null,
  };
}

async function detectReconcileSchemaSupport(input: {
  client: ReturnType<typeof createServiceRoleClient>;
}) {
  const client = input.client as unknown as UntypedAdminClient;
  const { error } = await client
    .from("shortlet_payments")
    .select("id,needs_reconcile,reconcile_reason,reconcile_locked_until,verify_attempts,last_verified_at")
    .range(0, 0);
  if (!error) return true;
  if (hasMissingReconcileColumnsError(error)) return false;
  throw new Error(error.message || "SHORTLET_RECONCILE_SCHEMA_PROBE_FAILED");
}

async function listShortletPaymentsForReconcileLegacy(input: {
  staleBeforeIso: string;
  limit: number;
  client: ReturnType<typeof createServiceRoleClient>;
}) {
  const client = input.client as unknown as UntypedAdminClient;
  const [initiatedRows, succeededRows] = await Promise.all([
    client
      .from("shortlet_payments")
      .select(LEGACY_RECONCILE_SELECT)
      .eq("status", "initiated")
      .lte("created_at", input.staleBeforeIso)
      .order("created_at", { ascending: true })
      .range(0, input.limit - 1),
    client
      .from("shortlet_payments")
      .select(LEGACY_RECONCILE_SELECT)
      .eq("status", "succeeded")
      .order("updated_at", { ascending: true })
      .range(0, input.limit - 1),
  ]);

  const errors = [initiatedRows.error, succeededRows.error].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors[0]?.message || "SHORTLET_RECONCILE_CANDIDATES_LEGACY_FAILED");
  }

  const merged = [...(initiatedRows.data || []), ...(succeededRows.data || [])] as Record<
    string,
    unknown
  >[];
  const deduped = new Map<string, ShortletPaymentReconcileRow>();
  for (const row of merged) {
    const normalized = normalizeLegacyReconcileRow(row);
    if (!normalized) continue;
    if (!deduped.has(normalized.id)) {
      deduped.set(normalized.id, normalized);
    }
  }
  return Array.from(deduped.values()).slice(0, input.limit);
}

async function reconcilePaystackCandidate(input: {
  candidate: ShortletPaymentReconcileRow;
  bookingCurrency: string;
  bookingAmountMinor: number;
  deps: InternalShortletReconcileDeps;
  client: ReturnType<typeof createServiceRoleClient>;
  nowIso: string;
  retryLockIso: string;
  paystackSecretKey: string | null;
  allowReconcileStateWrites: boolean;
}) {
  if (!input.paystackSecretKey) {
    if (input.allowReconcileStateWrites) {
      await input.deps.markShortletPaymentNeedsReconcile({
        paymentId: input.candidate.id,
        reason: "provider_verification_failed",
        lockUntilIso: input.retryLockIso,
        nowIso: input.nowIso,
        client: input.client,
      });
    }
    return { outcome: "flagged" as const };
  }

  const verified = await input.deps.verifyTransaction({
    secretKey: input.paystackSecretKey,
    reference: input.candidate.providerReference,
  });
  const payload = (verified.raw || {}) as Record<string, unknown>;
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  if (!verified.ok) {
    if (shouldMarkProviderFailure(verified.status)) {
      if (input.allowReconcileStateWrites) {
        await input.deps.markShortletPaymentFailed({
          provider: "paystack",
          providerReference: input.candidate.providerReference,
          providerPayload: payload,
          reconcileReason: "provider_not_paid",
          client: input.client,
        });
      }
      return { outcome: "failed" as const };
    }

    if (input.allowReconcileStateWrites) {
      await input.deps.markShortletPaymentNeedsReconcile({
        paymentId: input.candidate.id,
        reason: "provider_not_paid",
        lockUntilIso: input.retryLockIso,
        providerPayload: payload,
        nowIso: input.nowIso,
        client: input.client,
      });
    }
    return { outcome: "flagged" as const };
  }

  if (
    Math.max(0, Math.trunc(Number(verified.amountMinor || 0))) !== input.bookingAmountMinor ||
    normalizeCurrency(verified.currency) !== normalizeCurrency(input.bookingCurrency)
  ) {
    if (input.allowReconcileStateWrites) {
      await input.deps.markShortletPaymentNeedsReconcile({
        paymentId: input.candidate.id,
        reason: "provider_mismatch",
        lockUntilIso: input.retryLockIso,
        providerPayload: payload,
        nowIso: input.nowIso,
        client: input.client,
      });
    }
    return { outcome: "flagged" as const };
  }

  const paid = await input.deps.markShortletPaymentSucceededAndConfirmBooking({
    provider: "paystack",
    providerReference: input.candidate.providerReference,
    providerPayload: payload,
    providerTxId:
      typeof data.id === "string" || typeof data.id === "number" ? String(data.id) : null,
    client: input.client,
  });

  if (!paid.ok) {
    if (input.allowReconcileStateWrites) {
      await input.deps.markShortletPaymentNeedsReconcile({
        paymentId: input.candidate.id,
        reason:
          paid.reason === "BOOKING_STATUS_TRANSITION_FAILED"
            ? "booking_status_transition_failed"
            : "provider_status_unknown",
        lockUntilIso: input.retryLockIso,
        providerPayload: payload,
        nowIso: input.nowIso,
        client: input.client,
      });
    }
    return { outcome: "flagged" as const };
  }

  return { outcome: "reconciled" as const };
}

async function reconcileStripeCandidate(input: {
  candidate: ShortletPaymentReconcileRow;
  bookingCurrency: string;
  bookingAmountMinor: number;
  deps: InternalShortletReconcileDeps;
  client: ReturnType<typeof createServiceRoleClient>;
  nowIso: string;
  retryLockIso: string;
  stripeClient: ReturnType<typeof getStripeClient> | null;
  allowReconcileStateWrites: boolean;
}) {
  if (!input.stripeClient) {
    if (input.allowReconcileStateWrites) {
      await input.deps.markShortletPaymentNeedsReconcile({
        paymentId: input.candidate.id,
        reason: "provider_verification_failed",
        lockUntilIso: input.retryLockIso,
        nowIso: input.nowIso,
        client: input.client,
      });
    }
    return { outcome: "flagged" as const };
  }

  const session = (await input.stripeClient.checkout.sessions.retrieve(
    input.candidate.providerReference
  )) as StripeSessionLike;
  const paymentStatus = String(session.payment_status || "").toLowerCase();
  const payload = session as unknown as Record<string, unknown>;

  if (paymentStatus !== "paid") {
    if (shouldMarkProviderFailure(paymentStatus)) {
      if (input.allowReconcileStateWrites) {
        await input.deps.markShortletPaymentFailed({
          provider: "stripe",
          providerReference: input.candidate.providerReference,
          providerPayload: payload,
          reconcileReason: "provider_not_paid",
          client: input.client,
        });
      }
      return { outcome: "failed" as const };
    }

    if (input.allowReconcileStateWrites) {
      await input.deps.markShortletPaymentNeedsReconcile({
        paymentId: input.candidate.id,
        reason: "provider_not_paid",
        lockUntilIso: input.retryLockIso,
        providerPayload: payload,
        nowIso: input.nowIso,
        client: input.client,
      });
    }
    return { outcome: "flagged" as const };
  }

  const amountMinor = Math.max(0, Math.trunc(Number(session.amount_total || 0)));
  if (
    amountMinor !== input.bookingAmountMinor ||
    normalizeCurrency(session.currency) !== normalizeCurrency(input.bookingCurrency)
  ) {
    if (input.allowReconcileStateWrites) {
      await input.deps.markShortletPaymentNeedsReconcile({
        paymentId: input.candidate.id,
        reason: "provider_mismatch",
        lockUntilIso: input.retryLockIso,
        providerPayload: payload,
        nowIso: input.nowIso,
        client: input.client,
      });
    }
    return { outcome: "flagged" as const };
  }

  const paid = await input.deps.markShortletPaymentSucceededAndConfirmBooking({
    provider: "stripe",
    providerReference: input.candidate.providerReference,
    providerPayload: payload,
    providerTxId: resolveStripeTxId(session),
    client: input.client,
  });

  if (!paid.ok) {
    if (input.allowReconcileStateWrites) {
      await input.deps.markShortletPaymentNeedsReconcile({
        paymentId: input.candidate.id,
        reason:
          paid.reason === "BOOKING_STATUS_TRANSITION_FAILED"
            ? "booking_status_transition_failed"
            : "provider_status_unknown",
        lockUntilIso: input.retryLockIso,
        providerPayload: payload,
        nowIso: input.nowIso,
        client: input.client,
      });
    }
    return { outcome: "flagged" as const };
  }

  return { outcome: "reconciled" as const };
}

export async function postInternalShortletReconcilePaymentsResponse(
  request: NextRequest,
  deps: InternalShortletReconcileDeps = defaultDeps
) {
  const expectedSecret = deps.getCronSecret();
  if (!hasValidCronSecret(request, expectedSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ ok: false, error: "Service role not configured." }, { status: 503 });
  }

  const now = deps.now();
  const nowIso = now.toISOString();
  const staleBeforeIso = new Date(now.getTime() - STALE_WINDOW_MS).toISOString();
  const lockUntilIso = new Date(now.getTime() + RECONCILE_LOCK_MS).toISOString();
  const retryLockIso = new Date(now.getTime() + RECONCILE_RETRY_LOCK_MS).toISOString();
  const client = deps.createServiceRoleClient();

  const summary: ReconcileSummary = {
    ok: true,
    route: routeLabel,
    schemaMode: "reconcile_columns",
    scanned: 0,
    locked: 0,
    reconciled: 0,
    failedMarked: 0,
    skippedLocked: 0,
    skippedTerminal: 0,
    flaggedForReconcile: 0,
    errors: [],
  };

  const queryLimit = Number(request.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(200, Math.trunc(queryLimit)));

  let stripeClient: ReturnType<typeof getStripeClient> | null = null;
  try {
    const modes = await deps.getProviderModes();
    const stripeConfig = deps.getStripeConfigForMode(modes.stripeMode);
    if (stripeConfig.secretKey) {
      stripeClient = deps.getStripeClient(stripeConfig.secretKey);
    }
  } catch (error) {
    summary.errors.push(`stripe_config:${error instanceof Error ? error.message : "unknown"}`);
  }

  const paystackSecretKey = deps.hasPaystackServerEnv()
    ? deps.getPaystackServerConfig().secretKey || null
    : null;

  const hasReconcileColumns = await (deps.detectReconcileSchemaSupport ?? detectReconcileSchemaSupport)({
    client,
  });
  if (!hasReconcileColumns) {
    summary.schemaMode = "legacy_no_reconcile_columns";
    console.warn(`[${routeLabel}] legacy_mode_no_reconcile_columns`);
  }

  const candidates = hasReconcileColumns
    ? await deps.listShortletPaymentsForReconcile({
        staleBeforeIso,
        nowIso,
        limit,
        client,
      })
    : await (deps.listShortletPaymentsForReconcileLegacy ?? listShortletPaymentsForReconcileLegacy)({
        staleBeforeIso,
        limit,
        client,
      });

  summary.scanned = candidates.length;

  for (const candidate of candidates) {
    try {
      if (hasReconcileColumns) {
        const locked = await deps.lockShortletPaymentForReconcile({
          paymentId: candidate.id,
          verifyAttempts: candidate.verifyAttempts,
          lockUntilIso,
          nowIso,
          client,
        });
        if (!locked) {
          summary.skippedLocked += 1;
          continue;
        }
        summary.locked += 1;
      }

      const booking = await deps.getShortletPaymentCheckoutContextByBookingId({
        bookingId: candidate.bookingId,
        client,
      });

      if (!booking) {
        if (hasReconcileColumns) {
          await deps.markShortletPaymentNeedsReconcile({
            paymentId: candidate.id,
            reason: "booking_not_found",
            lockUntilIso: retryLockIso,
            nowIso,
            client,
          });
        }
        summary.flaggedForReconcile += 1;
        summary.errors.push(`${candidate.id}:booking_not_found`);
        continue;
      }

      if (
        candidate.status === "succeeded" &&
        isTerminalShortletBookingStatus(booking.status)
      ) {
        if (hasReconcileColumns) {
          await deps.clearShortletPaymentReconcileState({
            paymentId: candidate.id,
            nowIso,
            client,
          });
        }
        summary.skippedTerminal += 1;
        continue;
      }

      const outcome =
        candidate.provider === "paystack"
          ? await reconcilePaystackCandidate({
              candidate,
              bookingCurrency: booking.currency,
              bookingAmountMinor: booking.totalAmountMinor,
              deps,
              client,
              nowIso,
              retryLockIso,
              paystackSecretKey,
              allowReconcileStateWrites: hasReconcileColumns,
            })
          : await reconcileStripeCandidate({
              candidate,
              bookingCurrency: booking.currency,
              bookingAmountMinor: booking.totalAmountMinor,
              deps,
              client,
              nowIso,
              retryLockIso,
              stripeClient,
              allowReconcileStateWrites: hasReconcileColumns,
            });

      if (outcome.outcome === "reconciled") summary.reconciled += 1;
      if (outcome.outcome === "failed") summary.failedMarked += 1;
      if (outcome.outcome === "flagged") summary.flaggedForReconcile += 1;
    } catch (error) {
      summary.errors.push(
        `${candidate.id}:${error instanceof Error ? error.message : "reconcile_failed"}`
      );
      try {
        if (hasReconcileColumns) {
          await deps.markShortletPaymentNeedsReconcile({
            paymentId: candidate.id,
            reason: "provider_verification_failed",
            lockUntilIso: retryLockIso,
            nowIso,
            client,
          });
        }
        summary.flaggedForReconcile += 1;
      } catch {
        // no-op: best effort path already captured in summary errors.
      }
    }
  }

  console.log(`[${routeLabel}] done`, {
    schemaMode: summary.schemaMode,
    scanned: summary.scanned,
    locked: summary.locked,
    reconciled: summary.reconciled,
    failedMarked: summary.failedMarked,
    flaggedForReconcile: summary.flaggedForReconcile,
    skippedLocked: summary.skippedLocked,
    skippedTerminal: summary.skippedTerminal,
    errors: summary.errors.length,
  });

  return NextResponse.json(summary);
}

export async function POST(request: NextRequest) {
  return postInternalShortletReconcilePaymentsResponse(request);
}
