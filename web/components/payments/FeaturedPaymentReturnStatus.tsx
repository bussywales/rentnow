"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  reference: string;
};

type StatusPayload = {
  ok?: boolean;
  payment?: {
    status?: string;
    reference?: string;
    amount_minor?: number;
    currency?: string;
  } | null;
  featured_purchase?: {
    status?: string;
    featured_until?: string | null;
  } | null;
  error?: string;
};

function formatMoney(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export function FeaturedPaymentReturnStatus({ reference }: Props) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/payments/status?reference=${encodeURIComponent(reference)}`, {
          credentials: "include",
        });
        const data = (await response.json().catch(() => ({}))) as StatusPayload;
        if (!cancelled) {
          setPayload(data);
        }
      } catch (error) {
        if (!cancelled) {
          setPayload({ error: error instanceof Error ? error.message : "Unable to load payment status." });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
  }, [reference]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Processing payment…</p>
      </div>
    );
  }

  if (payload?.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-semibold text-rose-700">Unable to confirm payment</p>
        <p className="mt-1 text-sm text-rose-700">{payload.error}</p>
        <div className="mt-4">
          <Link href="/host" className="text-sm font-semibold text-sky-700 underline underline-offset-2">
            Back to host dashboard
          </Link>
        </div>
      </div>
    );
  }

  const paymentStatus = payload?.payment?.status || "pending";
  const activationStatus = payload?.featured_purchase?.status || "pending";
  const succeeded = paymentStatus === "succeeded" && activationStatus === "activated";
  const pending = paymentStatus === "initialized" || paymentStatus === "pending";
  const amountLabel =
    Number.isFinite(payload?.payment?.amount_minor ?? NaN) && payload?.payment?.currency
      ? formatMoney(payload?.payment?.amount_minor ?? 0, payload?.payment?.currency ?? "NGN")
      : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Featured payment status</h1>
      <p className="mt-1 text-sm text-slate-600">Reference: {reference}</p>
      {amountLabel ? <p className="mt-1 text-sm text-slate-600">Amount: {amountLabel}</p> : null}

      {succeeded ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Payment confirmed. Your listing is now featured.
        </p>
      ) : pending ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          We are still confirming your payment. This page refreshes automatically.
        </p>
      ) : (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Payment was not completed. You can try again from your host dashboard.
        </p>
      )}

      {payload?.featured_purchase?.featured_until ? (
        <p className="mt-3 text-sm text-slate-600">
          Featured until {new Date(payload.featured_purchase.featured_until).toLocaleDateString()}.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/host" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
          Open host dashboard
        </Link>
        <Link href="/dashboard/billing" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          Billing history
        </Link>
      </div>
    </div>
  );
}
