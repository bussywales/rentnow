"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type ReconcileResult = {
  ok?: boolean;
  paymentStatus?: string | null;
  activated?: boolean;
  alreadyActivated?: boolean;
  receiptSent?: boolean;
  receiptAlreadySent?: boolean;
  reason?: string;
  scanned?: number;
  reconciled?: number;
  receiptsSent?: number;
  verifyFailedCount?: number;
  errorCount?: number;
};

export default function AdminPaymentsReconcilePanel() {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (payload: { reference: string } | { mode: "stuck" | "receipts" | "batch" }) => {
    const ref = reference.trim();
    if ("reference" in payload && !ref) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/payments/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as ReconcileResult & { error?: string };
      if (!response.ok) {
        setError(data.error || data.reason || "Unable to reconcile payment.");
        return;
      }
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reconcile payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Reconcile Paystack reference</h2>
      <p className="mt-1 text-sm text-slate-600">
        Verify and reprocess a payment by reference. Safe to run multiple times.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="featpay_xxx or Paystack reference"
          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          data-testid="admin-payments-reconcile-input"
        />
        <Button
          type="button"
          onClick={() => submit({ reference: reference.trim() })}
          disabled={loading || !reference.trim()}
          data-testid="admin-payments-reconcile-submit"
        >
          {loading ? "Reconciling…" : "Run reconcile"}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => submit({ mode: "stuck" })}
          disabled={loading}
          data-testid="admin-payments-reconcile-stuck"
        >
          Reconcile stuck (30m+)
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => submit({ mode: "receipts" })}
          disabled={loading}
          data-testid="admin-payments-reconcile-receipts"
        >
          Reconcile receipts-only
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      {result ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p>
            Status: <span className="font-semibold">{result.paymentStatus || "unknown"}</span>
          </p>
          <p>Activated: {result.activated ? "Yes" : "No"}</p>
          <p>Already activated: {result.alreadyActivated ? "Yes" : "No"}</p>
          <p>Receipt sent this run: {result.receiptSent ? "Yes" : "No"}</p>
          <p>Receipt already sent: {result.receiptAlreadySent ? "Yes" : "No"}</p>
          {typeof result.scanned === "number" ? <p>Scanned: {result.scanned}</p> : null}
          {typeof result.reconciled === "number" ? <p>Reconciled: {result.reconciled}</p> : null}
          {typeof result.receiptsSent === "number" ? <p>Receipts sent: {result.receiptsSent}</p> : null}
          {typeof result.verifyFailedCount === "number" ? <p>Verify failed: {result.verifyFailedCount}</p> : null}
          {typeof result.errorCount === "number" ? <p>Errors: {result.errorCount}</p> : null}
          <p>Reason: {result.reason || "reconciled"}</p>
        </div>
      ) : null}
    </div>
  );
}
