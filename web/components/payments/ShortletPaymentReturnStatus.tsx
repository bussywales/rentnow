"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

export function ShortletPaymentReturnStatus(props: {
  bookingId: string;
  provider?: string | null;
  providerReference?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const shouldVerifyPaystack =
          String(props.provider || "").toLowerCase() === "paystack" &&
          String(props.providerReference || "").trim().length > 0;
        if (shouldVerifyPaystack) {
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
        if (!cancelled) setPayload(data);
      } catch (error) {
        if (!cancelled) {
          setPayload({
            error: error instanceof Error ? error.message : "Unable to load payment status",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (!cancelled) void load();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [props.bookingId, props.provider, props.providerReference]);

  const state = useMemo(() => {
    const bookingStatus = String(payload?.booking?.status || "").toLowerCase();
    const paymentStatus = String(payload?.payment?.status || "").toLowerCase();

    if (paymentStatus === "failed") return "failed" as const;
    if (bookingStatus === "confirmed" || bookingStatus === "completed") return "confirmed" as const;
    if (bookingStatus === "pending") return "pending" as const;
    if (bookingStatus === "pending_payment" || paymentStatus === "initiated" || !payload?.payment) {
      return "processing" as const;
    }
    if (bookingStatus === "declined" || bookingStatus === "cancelled" || bookingStatus === "expired") {
      return "closed" as const;
    }
    return "processing" as const;
  }, [payload]);

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
          We are still confirming your payment. This page refreshes automatically.
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
        <Link
          href={`/payments/shortlet/checkout?bookingId=${encodeURIComponent(props.bookingId)}`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retry payment
        </Link>
      </div>
    </section>
  );
}
