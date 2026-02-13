"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type StuckRow = {
  id: string;
  reference: string;
  created_at: string;
  amount_minor: number;
  currency: string;
  user_id: string;
  property_id: string;
  property_title: string;
};

type OpsSummary = {
  scanned: number;
  reconciled: number;
  activated: number;
  receiptsSent: number;
  alreadyActivated: number;
  receiptAlreadySent: number;
  verifyFailedCount: number;
  errorCount: number;
};

function formatAmount(currency: string, amountMinor: number) {
  const amount = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

export default function AdminPaymentsOpsPanel(props: {
  stuckCount: number;
  receiptsPendingCount: number;
  stuckRows: StuckRow[];
}) {
  const [loadingMode, setLoadingMode] = useState<"stuck" | "receipts" | "batch" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OpsSummary | null>(null);

  const runMode = async (mode: "stuck" | "receipts" | "batch") => {
    setLoadingMode(mode);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch("/api/admin/payments/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | (OpsSummary & { reason?: string; error?: string })
        | { reason?: string; error?: string };
      if (!response.ok) {
        setError(payload.error || payload.reason || "Unable to run reconcile.");
        return;
      }
      setSummary({
        scanned: Number((payload as OpsSummary).scanned || 0),
        reconciled: Number((payload as OpsSummary).reconciled || 0),
        activated: Number((payload as OpsSummary).activated || 0),
        receiptsSent: Number((payload as OpsSummary).receiptsSent || 0),
        alreadyActivated: Number((payload as OpsSummary).alreadyActivated || 0),
        receiptAlreadySent: Number((payload as OpsSummary).receiptAlreadySent || 0),
        verifyFailedCount: Number((payload as OpsSummary).verifyFailedCount || 0),
        errorCount: Number((payload as OpsSummary).errorCount || 0),
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to run reconcile.");
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Ops</h2>
          <p className="text-sm text-slate-600">
            Detect stuck payments and receipts pending delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => runMode("batch")}
            disabled={loadingMode !== null}
            data-testid="admin-payments-run-batch"
          >
            {loadingMode === "batch" ? "Running…" : "Run reconcile now"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => runMode("stuck")}
            disabled={loadingMode !== null || props.stuckCount === 0}
            data-testid="admin-payments-run-stuck"
          >
            {loadingMode === "stuck" ? "Running…" : "Reconcile stuck (30m+)"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => runMode("receipts")}
            disabled={loadingMode !== null || props.receiptsPendingCount === 0}
            data-testid="admin-payments-run-receipts"
          >
            {loadingMode === "receipts" ? "Running…" : "Reconcile receipts-only"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Stuck payments</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">{props.stuckCount}</p>
          <p className="text-xs text-amber-800">Pending or initialized for over 30 minutes.</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-sky-700">Receipts pending</p>
          <p className="mt-1 text-2xl font-semibold text-sky-900">{props.receiptsPendingCount}</p>
          <p className="text-xs text-sky-800">Succeeded payments without receipt sent.</p>
        </div>
      </div>

      {summary ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p>
            Scanned {summary.scanned} · Reconciled {summary.reconciled} · Activated {summary.activated} · Receipts sent{" "}
            {summary.receiptsSent}
          </p>
          <p>
            Already activated {summary.alreadyActivated} · Receipt already sent {summary.receiptAlreadySent} · Verify failed{" "}
            {summary.verifyFailedCount} · Errors {summary.errorCount}
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Listing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.stuckRows.length ? (
              props.stuckRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-mono text-xs">{row.reference || "—"}</td>
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">{formatAmount(row.currency, row.amount_minor)}</td>
                  <td className="px-3 py-2">
                    {row.property_id ? (
                      <a
                        href={`/properties/${row.property_id}`}
                        className="text-sky-700 underline underline-offset-2"
                      >
                        {row.property_title || "View listing"}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-500" colSpan={4}>
                  No stuck payments right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
