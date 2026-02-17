"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type StatusPayload = {
  ok?: boolean;
  error?: string;
  booking?: {
    id?: string;
    status?: string;
    booking_mode?: string;
    total_amount_minor?: number;
    currency?: string;
    listing_title?: string | null;
  } | null;
  payment?: {
    status?: string;
    provider?: string;
  } | null;
};

const STATUS_POLL_INTERVAL_MS = 5000;
const STATUS_POLL_MAX_MS = 60_000;
const TERMINAL_BOOKING_STATUSES = new Set(["pending", "confirmed", "completed", "declined", "cancelled", "expired"]);
const TERMINAL_PAYMENT_STATUSES = new Set(["failed", "refunded"]);

function formatMoney(currency: string, amountMinor: number) {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function isTerminalBooking(status: string | null | undefined) {
  return normalizeStatus(status) !== "pending_payment";
}

/**
 * Booking status is authoritative; do not stop polling on payment success while booking is pending_payment.
 */
export function shouldPoll(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  elapsedMs: number;
  maxPollMs?: number;
}) {
  if (input.elapsedMs >= (input.maxPollMs ?? STATUS_POLL_MAX_MS)) {
    return false;
  }
  if (TERMINAL_PAYMENT_STATUSES.has(normalizeStatus(input.paymentStatus))) {
    return false;
  }
  if (isTerminalBooking(input.bookingStatus)) {
    return false;
  }
  return true;
}

export function shouldPollStatus(
  paymentStatus: string | null | undefined,
  bookingStatus: string | null | undefined,
  elapsedMs: number,
  maxPollMs = STATUS_POLL_MAX_MS
) {
  return shouldPoll({
    paymentStatus,
    bookingStatus,
    elapsedMs,
    maxPollMs,
  });
}

function resolvePollStopReason(
  paymentStatus: string | null | undefined,
  bookingStatus: string | null | undefined,
  elapsedMs: number,
  maxPollMs: number
) {
  if (elapsedMs >= maxPollMs) return "timeout" as const;
  if (TERMINAL_PAYMENT_STATUSES.has(normalizeStatus(paymentStatus))) return "terminal_payment" as const;
  if (isTerminalBooking(bookingStatus)) return "terminal_booking" as const;
  return "continue" as const;
}

export function resolveReturnUiState(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  hasPayment: boolean;
}) {
  const bookingStatus = normalizeStatus(input.bookingStatus);
  const paymentStatus = normalizeStatus(input.paymentStatus);

  if (paymentStatus === "failed" || paymentStatus === "refunded") return "failed" as const;
  if (bookingStatus === "confirmed" || bookingStatus === "completed") return "confirmed" as const;
  if (bookingStatus === "pending") return "pending" as const;
  if (TERMINAL_BOOKING_STATUSES.has(bookingStatus)) return "closed" as const;
  if (bookingStatus === "pending_payment" || paymentStatus === "initiated" || !input.hasPayment) {
    return "processing" as const;
  }
  return "processing" as const;
}

export function ShortletPaymentReturnStatus(props: {
  bookingId: string;
  provider?: string | null;
  providerReference?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyAttempted, setVerifyAttempted] = useState(false);
  const previousStatusRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let timeoutFinalFetchDone = false;
    const startedAt = Date.now();

    const shouldVerifyPaystack =
      String(props.provider || "").toLowerCase() === "paystack" &&
      String(props.providerReference || "").trim().length > 0;
    console.log("[/payments/shortlet/return] init", {
      bookingId: props.bookingId,
      provider: props.provider || null,
      referencePresent: Boolean(String(props.providerReference || "").trim()),
      verifyOnMount: shouldVerifyPaystack,
    });

    const loadStatus = async () => {
      try {
        const response = await fetch(
          `/api/shortlet/payments/status?booking_id=${encodeURIComponent(props.bookingId)}`,
          { credentials: "include" }
        );
        const data = (await response.json().catch(() => ({}))) as StatusPayload;
        if (!cancelled) {
          setPayload(data);
          setLastCheckedAt(Date.now());
        }
        return data;
      } catch (error) {
        if (!cancelled) {
          setPayload({
            error: error instanceof Error ? error.message : "Unable to load payment status",
          });
        }
        return null;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const runVerifyOnce = async () => {
      if (!shouldVerifyPaystack) return;
      setVerifyAttempted(true);
      const response = await fetch(
        `/api/shortlet/payments/paystack/verify?reference=${encodeURIComponent(
          String(props.providerReference || "")
        )}&booking_id=${encodeURIComponent(props.bookingId)}`,
        { credentials: "include" }
      ).catch(() => null);
      const verifyResult =
        response &&
        (await response
          .json()
          .then((value) => (value && typeof value === "object" ? (value as Record<string, unknown>) : null))
          .catch(() => null));
      console.log("[/payments/shortlet/return] verify-complete", {
        bookingId: props.bookingId,
        httpStatus: response?.status ?? null,
        ok: response?.ok ?? false,
        resultStatus:
          verifyResult && typeof verifyResult.status === "string" ? verifyResult.status : null,
        bookingStatus:
          verifyResult && typeof verifyResult.booking_status === "string"
            ? verifyResult.booking_status
            : null,
      });
    };

    const scheduleNext = (statusPayload: StatusPayload | null) => {
      const elapsedMs = Date.now() - startedAt;
      const shouldContinuePolling = shouldPoll({
        paymentStatus: statusPayload?.payment?.status ?? null,
        bookingStatus: statusPayload?.booking?.status ?? null,
        elapsedMs,
        maxPollMs: STATUS_POLL_MAX_MS,
      });
      if (!shouldContinuePolling) {
        const reason = resolvePollStopReason(
        statusPayload?.payment?.status ?? null,
        statusPayload?.booking?.status ?? null,
        elapsedMs,
        STATUS_POLL_MAX_MS
        );
        if (reason === "timeout" && !timeoutFinalFetchDone) {
          timeoutFinalFetchDone = true;
          void (async () => {
            const finalPayload = await loadStatus();
            if (cancelled) return;
            const finalShouldContinuePolling = shouldPoll({
              paymentStatus: finalPayload?.payment?.status ?? null,
              bookingStatus: finalPayload?.booking?.status ?? null,
              elapsedMs: Date.now() - startedAt,
              maxPollMs: STATUS_POLL_MAX_MS,
            });
            const finalReason = resolvePollStopReason(
              finalPayload?.payment?.status ?? null,
              finalPayload?.booking?.status ?? null,
              Date.now() - startedAt,
              STATUS_POLL_MAX_MS
            );
            const timedOutAfterFinalFetch = !finalShouldContinuePolling && finalReason === "timeout";
            setTimedOut(timedOutAfterFinalFetch);
            console.log("[/payments/shortlet/return] polling-stop", {
              bookingId: props.bookingId,
              reason: timedOutAfterFinalFetch ? "timeout" : "terminal_after_timeout_final_fetch",
              elapsedMs: Date.now() - startedAt,
              bookingStatus: finalPayload?.booking?.status ?? null,
              paymentStatus: finalPayload?.payment?.status ?? null,
            });
          })();
          return;
        }
        setTimedOut(reason === "timeout");
        console.log("[/payments/shortlet/return] polling-stop", {
          bookingId: props.bookingId,
          reason,
          elapsedMs,
          bookingStatus: statusPayload?.booking?.status ?? null,
          paymentStatus: statusPayload?.payment?.status ?? null,
        });
        return;
      }
      pollTimer = window.setTimeout(async () => {
        const next = await loadStatus();
        if (!cancelled) scheduleNext(next);
      }, STATUS_POLL_INTERVAL_MS);
    };

    const run = async () => {
      await runVerifyOnce();
      const firstPayload = await loadStatus();
      if (!cancelled) scheduleNext(firstPayload);
    };

    void run();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [props.bookingId, props.provider, props.providerReference]);

  useEffect(() => {
    if (!payload) return;
    const bookingStatus = normalizeStatus(payload.booking?.status);
    const paymentStatus = normalizeStatus(payload.payment?.status);
    const key = `${bookingStatus}|${paymentStatus}`;
    if (previousStatusRef.current === key) return;
    previousStatusRef.current = key;
    console.log("[/payments/shortlet/return] status-change", {
      bookingId: props.bookingId,
      bookingStatus: bookingStatus || null,
      paymentStatus: paymentStatus || null,
    });
  }, [payload, props.bookingId]);

  const runManualRefresh = async () => {
    setRefreshing(true);
    try {
      if (
        String(props.provider || "").toLowerCase() === "paystack" &&
        String(props.providerReference || "").trim().length > 0
      ) {
        await fetch(
          `/api/shortlet/payments/paystack/verify?reference=${encodeURIComponent(
            String(props.providerReference || "")
          )}&booking_id=${encodeURIComponent(props.bookingId)}`,
          { credentials: "include" }
        ).catch(() => null);
      }
      const response = await fetch(
        `/api/shortlet/payments/status?booking_id=${encodeURIComponent(props.bookingId)}`,
        { credentials: "include" }
      );
      const data = (await response.json().catch(() => ({}))) as StatusPayload;
      setPayload(data);
      setLastCheckedAt(Date.now());
      setTimedOut(false);
    } catch (error) {
      setPayload({
        error: error instanceof Error ? error.message : "Unable to refresh payment status",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const state = useMemo(() => {
    return resolveReturnUiState({
      bookingStatus: payload?.booking?.status ?? null,
      paymentStatus: payload?.payment?.status ?? null,
      hasPayment: Boolean(payload?.payment),
    });
  }, [payload]);

  const canRetryPayment = !["confirmed", "pending"].includes(state);
  const showTimeoutState = timedOut && state === "processing";

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Checking payment status...</p>
      </section>
    );
  }

  if (payload?.error) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {payload.error}
      </section>
    );
  }

  const amountLabel =
    Number.isFinite(payload?.booking?.total_amount_minor ?? NaN) && payload?.booking?.currency
      ? formatMoney(
          payload.booking.currency || "NGN",
          Number(payload.booking.total_amount_minor || 0)
        )
      : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Shortlet payment status</h1>
      <p className="mt-1 text-sm text-slate-600">Booking ID: {props.bookingId}</p>
      {amountLabel ? <p className="text-sm text-slate-600">Total: {amountLabel}</p> : null}

      {state === "processing" ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          We are still confirming your payment.
        </p>
      ) : null}
      {showTimeoutState ? (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Confirmation is taking longer than usual. You can refresh status now or contact support.
        </p>
      ) : null}
      {state === "pending" ? (
        <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          Payment received. Your booking request is now waiting for host approval.
        </p>
      ) : null}
      {state === "confirmed" ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Payment received and your reservation is confirmed.
        </p>
      ) : null}
      {state === "failed" ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Payment was not successful. You can retry checkout.
        </p>
      ) : null}
      {state === "closed" ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          This booking is closed.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/trips/${props.bookingId}`} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
          Open trip
        </Link>
        <button
          type="button"
          onClick={runManualRefresh}
          disabled={refreshing}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {refreshing ? "Refreshing..." : "Refresh status"}
        </button>
        <Link href="/support" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          Contact support
        </Link>
        {canRetryPayment ? (
          <Link
            href={`/payments/shortlet/checkout?bookingId=${encodeURIComponent(props.bookingId)}`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Retry payment
          </Link>
        ) : null}
      </div>
      {verifyAttempted || lastCheckedAt ? (
        <p className="mt-3 text-xs text-slate-500">
          {verifyAttempted ? "Paystack verify checked." : "Status checked."}
        </p>
      ) : null}
    </section>
  );
}
