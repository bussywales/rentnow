"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ReminderRun = {
  runKey: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: "started" | "succeeded" | "failed";
  meta: Record<string, unknown>;
  error: string | null;
};

type OpsPayload = {
  ok: true;
  route: string;
  asOf: string;
  reminders: {
    lastRun: ReminderRun | null;
    lastSuccess: ReminderRun | null;
    lastFailure: ReminderRun | null;
    recentRuns: ReminderRun[];
  };
  payouts: {
    requestedCount: number;
    oldestRequestedAt: string | null;
    lastPaidAt: string | null;
    recentRequested: Array<{
      payoutId: string;
      bookingId: string;
      requestedAt: string;
      status: "eligible" | "paid";
    }>;
  };
  mismatches: {
    stuckSucceededPaymentCount: number;
    sample: Array<{
      bookingId: string;
      paymentId: string;
      paymentUpdatedAt: string | null;
      bookingCreatedAt: string | null;
    }>;
  };
  sla: {
    dueSoonCount: number;
    overdueCount: number;
    sample: Array<{
      bookingId: string;
      respondBy: string;
      createdAt: string | null;
      listingId: string | null;
    }>;
  };
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

function formatRelativeMinutes(value: string | null | undefined) {
  if (!value) return "";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  const diffMinutes = Math.round((ms - Date.now()) / 60_000);
  if (diffMinutes >= 0) return `in ${diffMinutes}m`;
  return `${Math.abs(diffMinutes)}m ago`;
}

export function AdminShortletsOpsDashboard() {
  const [data, setData] = useState<OpsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/shortlets/ops", {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as OpsPayload | { error?: string } | null;
      if (!response.ok || !body || !("ok" in body) || body.ok !== true) {
        throw new Error(
          (body && "error" in body && typeof body.error === "string" && body.error) ||
            "Unable to load shortlets ops data."
        );
      }
      setData(body);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load shortlets ops data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const remindersHealth = useMemo(() => {
    if (!data?.reminders.lastRun) return "No runs yet";
    if (data.reminders.lastRun.status === "failed") return "Last run failed";
    if (data.reminders.lastRun.status === "started") return "Run in progress";
    return "Healthy";
  }, [data]);

  return (
    <section className="space-y-4" data-testid="admin-shortlets-ops-dashboard">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Live readiness</p>
            <p className="text-xs text-slate-600">
              Snapshot of reminders, payouts queue, approval SLA risk, and payment mismatches.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void load(true);
            }}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            disabled={refreshing}
            data-testid="admin-shortlets-ops-refresh"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </div>

      <div
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        data-testid="admin-shortlets-ops-metrics"
      >
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Reminders</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{remindersHealth}</p>
          <p className="mt-2 text-xs text-slate-600">
            Last run: {formatDateTime(data?.reminders.lastRun?.startedAt || null)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Payout requests</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {data?.payouts.requestedCount ?? 0}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Oldest request: {formatDateTime(data?.payouts.oldestRequestedAt || null)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Approvals SLA</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {(data?.sla.dueSoonCount ?? 0) + (data?.sla.overdueCount ?? 0)}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Due soon: {data?.sla.dueSoonCount ?? 0} · Overdue: {data?.sla.overdueCount ?? 0}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Payment mismatches</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {data?.mismatches.stuckSucceededPaymentCount ?? 0}
          </p>
          <p className="mt-2 text-xs text-slate-600">Succeeded payment but booking still pending_payment.</p>
        </article>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" open>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Reminder runs
        </summary>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading reminder runs…</p>
        ) : data?.reminders.recentRuns.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">Finished</th>
                  <th className="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.reminders.recentRuns.map((run) => (
                  <tr key={run.runKey}>
                    <td className="px-3 py-2 text-slate-700">{run.status}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDateTime(run.startedAt)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDateTime(run.finishedAt)}</td>
                    <td className="px-3 py-2 text-slate-600">{run.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No runs yet</p>
        )}
      </details>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Payout requests queue
        </summary>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading payout signals…</p>
        ) : data?.payouts.recentRequested.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.payouts.recentRequested.map((row) => (
                  <tr key={`${row.payoutId}:${row.bookingId}`}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.bookingId}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatDateTime(row.requestedAt)}{" "}
                      <span className="text-slate-400">{formatRelativeMinutes(row.requestedAt)}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No payout requests queued.</p>
        )}
      </details>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Approval SLA risk
        </summary>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading approval risk…</p>
        ) : data?.sla.sample.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">Respond by</th>
                  <th className="px-3 py-2">Listing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sla.sample.map((row) => (
                  <tr key={row.bookingId}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.bookingId}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDateTime(row.respondBy)}</td>
                    <td className="px-3 py-2 text-slate-600">{row.listingId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No due-soon or overdue approvals.</p>
        )}
      </details>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Payment mismatches
        </summary>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading payment mismatches…</p>
        ) : data?.mismatches.sample.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.mismatches.sample.map((row) => (
                  <tr key={`${row.bookingId}:${row.paymentId}`}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.bookingId}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.paymentId}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDateTime(row.paymentUpdatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No payment mismatches detected.</p>
        )}
      </details>
    </section>
  );
}
