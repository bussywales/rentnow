"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SHORTLET_STATUS_POLL_TIMEOUT_MS,
  getPollingStopReason,
  normalizeShortletBookingStatus,
  normalizeShortletPaymentStatus,
  resolvePollingAction,
  resolveShortletReturnUiState,
  shouldPoll,
} from "@/lib/shortlet/return-status";

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
const STATUS_POLL_MAX_MS = SHORTLET_STATUS_POLL_TIMEOUT_MS;
const FORCE_RECHECK_THROTTLE_MS = 4000;

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
    timeoutMs: maxPollMs,
  });
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
  const [forceRechecking, setForceRechecking] = useState(false);
  const [verifyAttempted, setVerifyAttempted] = useState(false);
  const [forceRecheckMessage, setForceRecheckMessage] = useState<string | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const lastForceRecheckAtRef = useRef(0);

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
      const action = resolvePollingAction({
        paymentStatus: statusPayload?.payment?.status ?? null,
        bookingStatus: statusPayload?.booking?.status ?? null,
        elapsedMs,
        timeoutMs: STATUS_POLL_MAX_MS,
        timeoutFinalFetchDone,
      });
      if (action !== "continue") {
        const reason = getPollingStopReason({
          paymentStatus: statusPayload?.payment?.status ?? null,
          bookingStatus: statusPayload?.booking?.status ?? null,
          elapsedMs,
          timeoutMs: STATUS_POLL_MAX_MS,
        });
        if (action === "final_fetch_then_stop") {
          timeoutFinalFetchDone = true;
          void (async () => {
            const finalPayload = await loadStatus();
            if (cancelled) return;
            const finalReason = getPollingStopReason({
              paymentStatus: finalPayload?.payment?.status ?? null,
              bookingStatus: finalPayload?.booking?.status ?? null,
              elapsedMs: Date.now() - startedAt,
              timeoutMs: STATUS_POLL_MAX_MS,
            });
            const timedOutAfterFinalFetch = finalReason === "timeout";
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
    const bookingStatus = normalizeShortletBookingStatus(payload.booking?.status);
    const paymentStatus = normalizeShortletPaymentStatus(payload.payment?.status);
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

  const runForceRecheck = async () => {
    const hasPaystackReference =
      String(props.provider || "").toLowerCase() === "paystack" &&
      String(props.providerReference || "").trim().length > 0;
    if (!hasPaystackReference) {
      await runManualRefresh();
      return;
    }

    const nowMs = Date.now();
    if (nowMs - lastForceRecheckAtRef.current < FORCE_RECHECK_THROTTLE_MS) {
      setForceRecheckMessage("Please wait a few seconds before forcing another re-check.");
      return;
    }
    lastForceRecheckAtRef.current = nowMs;
    setForceRecheckMessage(null);
    setForceRechecking(true);
    try {
      setVerifyAttempted(true);
      await fetch(
        `/api/shortlet/payments/paystack/verify?reference=${encodeURIComponent(
          String(props.providerReference || "")
        )}&booking_id=${encodeURIComponent(props.bookingId)}`,
        { credentials: "include" }
      ).catch(() => null);
      await runManualRefresh();
    } finally {
      setForceRechecking(false);
    }
  };

  const state = useMemo(() => {
    return resolveShortletReturnUiState({
      bookingStatus: payload?.booking?.status ?? null,
      paymentStatus: payload?.payment?.status ?? null,
    });
  }, [payload]);

  const bookingStatus = normalizeShortletBookingStatus(payload?.booking?.status);
  const paymentStatus = normalizeShortletPaymentStatus(payload?.payment?.status);
  const isPaymentSucceededPendingFinalisation =
    paymentStatus === "succeeded" && bookingStatus === "pending_payment";

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
          {isPaymentSucceededPendingFinalisation
            ? "Payment received. Finalising your booking..."
            : "We are still confirming your payment."}
        </p>
      ) : null}
      {showTimeoutState ? (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Confirmation is taking longer than usual. You can refresh status now or contact support.
        </p>
      ) : null}
      {state === "pending" ? (
        <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          Payment received. Your booking request is waiting for host approval within 12 hours.
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
          disabled={refreshing || forceRechecking}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {refreshing ? "Refreshing..." : "Refresh status"}
        </button>
        {String(props.provider || "").toLowerCase() === "paystack" &&
        String(props.providerReference || "").trim().length > 0 ? (
          <button
            type="button"
            onClick={runForceRecheck}
            disabled={refreshing || forceRechecking}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            {forceRechecking ? "Re-checking..." : "Force re-check"}
          </button>
        ) : null}
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
      {forceRecheckMessage ? (
        <p className="mt-2 text-xs text-amber-700">{forceRecheckMessage}</p>
      ) : null}
    </section>
  );
}
