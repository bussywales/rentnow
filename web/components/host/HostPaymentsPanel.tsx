"use client";

import { useEffect, useMemo, useState } from "react";

type PaymentRow = {
  id: string;
  created_at: string;
  amount_minor: number;
  currency: string;
  status: string;
  reference: string;
  property_id: string;
  property_title: string;
  featured_request_id: string;
  plan: string;
  receipt_email_sent_at: string | null;
};

function formatAmount(currency: string, amountMinor: number) {
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

function normalizePlan(plan: string) {
  if (plan === "featured_30d") return "Featured 30d";
  if (plan === "featured_7d") return "Featured 7d";
  return "Featured";
}

export function HostPaymentsPanel() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch("/api/payments/mine", {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          payments?: PaymentRow[];
          error?: string;
        };
        if (!response.ok) {
          if (!cancelled) setError(payload.error || "Unable to load payment history.");
          return;
        }
        if (!cancelled) setRows(Array.isArray(payload.payments) ? payload.payments : []);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load payment history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasRows = useMemo(() => rows.length > 0, [rows]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="host-payments-panel">
      <h2 className="text-base font-semibold text-slate-900">Payments</h2>
      <p className="mt-1 text-sm text-slate-600">Recent Featured payments for your listings.</p>
      {loading ? <p className="mt-3 text-sm text-slate-500">Loading payments…</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {!loading && !error && !hasRows ? (
        <p className="mt-3 text-sm text-slate-500">No payments yet.</p>
      ) : null}

      {!loading && !error && hasRows ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Listing</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{row.property_title || "Listing"}</td>
                  <td className="px-3 py-2">{normalizePlan(row.plan)}</td>
                  <td className="px-3 py-2">{formatAmount(row.currency || "NGN", row.amount_minor || 0)}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">
                    {row.receipt_email_sent_at ? "Sent" : "Not sent"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
