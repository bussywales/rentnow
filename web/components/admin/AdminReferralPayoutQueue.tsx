"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import { buildAdminReferralAttributionContextUrl } from "@/lib/referrals/cashout-context";

type QueueStatus = "pending" | "held" | "approved" | "rejected" | "paid" | "void";
type RiskLevel = "none" | "low" | "medium" | "high";

type QueueRequest = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  rate_used: number;
  status: "pending" | "approved" | "rejected" | "paid" | "void";
  queue_status: QueueStatus;
  admin_note: string | null;
  payout_reference: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  risk_level: RiskLevel;
  risk_flags: string[];
  risk_stats: {
    captures_1h: number;
    captures_24h: number;
    distinct_ip_hash_24h: number;
    distinct_ua_hash_24h: number;
    geo_mismatch_count_24h: number;
    deep_referrals_30d: number;
    max_depth_30d: number;
  };
  requires_manual_approval: boolean;
  last_action: {
    action_type: string;
    actor_id: string | null;
    actor_name: string | null;
    created_at: string;
  } | null;
};

type Props = {
  initialRequests: QueueRequest[];
};

const STATUS_PILLS: Array<{ value: QueueStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "held", label: "Held" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const RISK_PILLS: Array<{ value: "any" | "flagged"; label: string }> = [
  { value: "any", label: "Any risk" },
  { value: "flagged", label: "Flagged only" },
];

const TIMEFRAME_PILLS: Array<{ value: "today" | "7d" | "30d" | "all"; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

const REASON_TEMPLATES = [
  "KYC incomplete",
  "Suspicious activity",
  "Policy restricted",
  "Duplicate / self-referral",
  "Manual review required",
];

type ConfirmState = null | {
  mode: "single" | "bulk";
  action: "approve" | "reject" | "paid" | "void" | "bulk_approve" | "bulk_reject";
  ids: string[];
  title: string;
  description: string;
  requiresReason: boolean;
  defaultReason: string;
  defaultPayoutReference: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(Math.max(0, Number(value || 0)));
}

function statusChipClass(status: QueueStatus) {
  if (status === "held") return "bg-amber-100 text-amber-800";
  if (status === "approved") return "bg-sky-100 text-sky-800";
  if (status === "rejected" || status === "void") return "bg-rose-100 text-rose-800";
  if (status === "paid") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-200 text-slate-700";
}

function riskChipClass(level: RiskLevel) {
  if (level === "high") return "bg-rose-100 text-rose-800";
  if (level === "medium") return "bg-amber-100 text-amber-800";
  if (level === "low") return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-600";
}

function buildQueryString(filters: {
  status: QueueStatus | "all";
  risk: "any" | "flagged";
  countryCode: string;
  timeframe: "today" | "7d" | "30d" | "all";
}) {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.risk !== "any") params.set("risk", filters.risk);
  if (filters.countryCode) params.set("country_code", filters.countryCode);
  if (filters.timeframe !== "30d") params.set("timeframe", filters.timeframe);
  return params.toString();
}

export default function AdminReferralPayoutQueue({ initialRequests }: Props) {
  const [requests, setRequests] = useState<QueueRequest[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<QueueStatus | "all">("all");
  const [riskFilter, setRiskFilter] = useState<"any" | "flagged">("any");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [timeframeFilter, setTimeframeFilter] = useState<"today" | "7d" | "30d" | "all">("30d");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [reasonTemplate, setReasonTemplate] = useState<string>("");
  const [reasonText, setReasonText] = useState<string>("");
  const [payoutReference, setPayoutReference] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [triageRequest, setTriageRequest] = useState<QueueRequest | null>(null);
  const [pending, startTransition] = useTransition();

  const queryString = useMemo(
    () =>
      buildQueryString({
        status: statusFilter,
        risk: riskFilter,
        countryCode: countryFilter,
        timeframe: timeframeFilter,
      }),
    [statusFilter, riskFilter, countryFilter, timeframeFilter]
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/referrals/cashouts${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Unable to load payout queue."));
        return;
      }
      setRequests(Array.isArray(payload.requests) ? payload.requests : []);
      setSelectedIds(new Set());
    } catch {
      setError("Unable to load payout queue.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const countryOptions = useMemo(() => {
    return Array.from(new Set(requests.map((row) => row.country_code).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [requests]);

  const selectedRows = useMemo(
    () => requests.filter((row) => selectedIds.has(row.id)),
    [requests, selectedIds]
  );

  const hasHeldSelection = selectedRows.some((row) => row.queue_status === "held");
  const hasNonPendingSelection = selectedRows.some((row) => row.status !== "pending");

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(requests.map((row) => row.id)));
  };

  const toggleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openConfirm = (
    state: NonNullable<ConfirmState>,
    options?: { reason?: string; payoutReference?: string; reasonTemplate?: string }
  ) => {
    setConfirmState(state);
    setReasonText(options?.reason ?? state.defaultReason ?? "");
    setPayoutReference(options?.payoutReference ?? state.defaultPayoutReference ?? "");
    setReasonTemplate(options?.reasonTemplate ?? "");
  };

  const openRequestActionConfirm = (
    request: QueueRequest,
    action: "approve" | "reject" | "void" | "paid"
  ) => {
    const held = request.queue_status === "held";
    if (action === "approve") {
      openConfirm(
        {
          mode: "single",
          action: "approve",
          ids: [request.id],
          title: held ? "Approve HELD request" : "Approve request",
          description: held
            ? "HELD requests need explicit reason before approval."
            : "Approve this payout request.",
          requiresReason: held,
          defaultReason: request.admin_note || "",
          defaultPayoutReference: request.payout_reference || "",
        },
        { reason: request.admin_note || "" }
      );
      return;
    }

    if (action === "reject") {
      openConfirm(
        {
          mode: "single",
          action: "reject",
          ids: [request.id],
          title: "Reject request",
          description: "Provide a reason before rejecting.",
          requiresReason: true,
          defaultReason: request.admin_note || "",
          defaultPayoutReference: request.payout_reference || "",
        },
        { reason: request.admin_note || "" }
      );
      return;
    }

    if (action === "void") {
      openConfirm({
        mode: "single",
        action: "void",
        ids: [request.id],
        title: "Void request",
        description: "Void this request. This cannot be reversed from queue actions.",
        requiresReason: false,
        defaultReason: request.admin_note || "",
        defaultPayoutReference: request.payout_reference || "",
      });
      return;
    }

    openConfirm(
      {
        mode: "single",
        action: "paid",
        ids: [request.id],
        title: "Mark as paid",
        description: "Record payout reference and mark request as paid.",
        requiresReason: false,
        defaultReason: request.admin_note || "",
        defaultPayoutReference: request.payout_reference || "",
      },
      { payoutReference: request.payout_reference || "" }
    );
  };

  const executeConfirm = () => {
    if (!confirmState) return;
    const finalReason = String(reasonText || reasonTemplate || "").trim();
    if (confirmState.requiresReason && !finalReason) {
      setError("Reason is required for this action.");
      return;
    }

    setError(null);
    setToast(null);
    startTransition(async () => {
      try {
        if (confirmState.mode === "bulk") {
          const action = confirmState.action;
          const response = await fetch("/api/admin/referrals/cashouts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              request_ids: confirmState.ids,
              reason: finalReason || null,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            throw new Error(String(payload?.error || "Bulk action failed."));
          }
          setToast(action === "bulk_approve" ? "Bulk approved." : "Bulk rejected.");
        } else {
          const id = confirmState.ids[0];
          if (!id) throw new Error("Missing request id.");
          const response = await fetch(`/api/admin/referrals/cashouts/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: confirmState.action,
              admin_note: finalReason || null,
              payout_reference: payoutReference.trim() || null,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            throw new Error(String(payload?.error || payload?.reason || "Action failed."));
          }
          setToast("Updated.");
        }
        setConfirmState(null);
        await loadRequests();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  };

  const exportHref = `/api/admin/referrals/cashouts/export.csv${queryString ? `?${queryString}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Filters</p>
          <a
            href={exportHref}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Export CSV
          </a>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setStatusFilter(pill.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                statusFilter === pill.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {RISK_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setRiskFilter(pill.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                riskFilter === pill.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {TIMEFRAME_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setTimeframeFilter(pill.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                timeframeFilter === pill.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="max-w-xs">
          <Select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
            <option value="">All countries</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </Select>
        </div>

        {statusFilter === "held" ? (
          <p className="text-xs text-amber-700">Showing held requests only.</p>
        ) : null}
        {statusFilter === "pending" ? (
          <p className="text-xs text-slate-600">Showing pending requests only.</p>
        ) : null}
        {riskFilter === "flagged" ? (
          <p className="text-xs text-slate-600">Showing flagged requests only.</p>
        ) : null}
      </div>

      {selectedRows.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-700">{selectedRows.length} selected</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || hasHeldSelection || hasNonPendingSelection}
              onClick={() =>
                openConfirm({
                  mode: "bulk",
                  action: "bulk_approve",
                  ids: selectedRows.map((row) => row.id),
                  title: "Bulk approve requests",
                  description:
                    "Approve selected pending requests. HELD requests cannot be bulk-approved.",
                  requiresReason: false,
                  defaultReason: "",
                  defaultPayoutReference: "",
                })
              }
            >
              Bulk approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                openConfirm({
                  mode: "bulk",
                  action: "bulk_reject",
                  ids: selectedRows.map((row) => row.id),
                  title: "Bulk reject requests",
                  description:
                    "Reject selected pending/held requests. Reason is required for all selected rows.",
                  requiresReason: true,
                  defaultReason: "",
                  defaultPayoutReference: "",
                })
              }
            >
              Bulk reject
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all requests"
                  checked={requests.length > 0 && selectedIds.size === requests.length}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                />
              </th>
              <th className="px-3 py-3 text-left">Request</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Risk</th>
              <th className="px-3 py-3 text-left">Amount</th>
              <th className="px-3 py-3 text-left">Country</th>
              <th className="px-3 py-3 text-left">Requested at</th>
              <th className="px-3 py-3 text-left">Last action</th>
              <th className="px-3 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((request) => {
              const canApprove = request.status === "pending";
              const canReject = request.status === "pending";
              const canVoid = request.status === "pending" || request.status === "approved";
              const canPaid = request.status === "approved";
              const contextHref = buildAdminReferralAttributionContextUrl({
                referrerUserId: request.user_id,
                requestedAt: request.requested_at,
              });
              const riskTitle =
                request.risk_flags.length > 0
                  ? `Flags: ${request.risk_flags.join(", ")}`
                  : "No risk flags";

              return (
                <tr key={request.id} data-testid="admin-referrals-cashout-row">
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Select request ${request.id}`}
                      checked={selectedIds.has(request.id)}
                      onChange={(event) => toggleSelectRow(request.id, event.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold text-slate-900">
                      {request.user.full_name || request.user.id}
                    </p>
                    <p className="text-xs text-slate-500">{request.id}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                        statusChipClass(request.queue_status)
                      )}
                    >
                      {request.queue_status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="space-y-1" title={riskTitle}>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                          riskChipClass(request.risk_level)
                        )}
                      >
                        {request.risk_level === "none" ? "None" : request.risk_level}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {request.risk_flags.slice(0, 3).map((flag) => (
                          <span
                            key={flag}
                            className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold text-slate-900">
                      {request.credits_requested} credits
                    </p>
                    <p className="text-xs text-slate-600">
                      {formatCurrency(request.cash_amount, request.currency)} ({request.currency})
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">{request.country_code}</td>
                  <td className="px-3 py-3 align-top">{formatDate(request.requested_at)}</td>
                  <td className="px-3 py-3 align-top">
                    {request.last_action ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {request.last_action.action_type}
                        </p>
                        <p className="text-xs text-slate-500">
                          {request.last_action.actor_name || request.last_action.actor_id || "Admin"} ·{" "}
                          {formatDate(request.last_action.created_at)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={contextHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        View context
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setTriageRequest(request)}
                      >
                        Triage
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canApprove || pending}
                        onClick={() => openRequestActionConfirm(request, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!canReject || pending}
                        onClick={() => openRequestActionConfirm(request, "reject")}
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!canVoid || pending}
                        onClick={() => openRequestActionConfirm(request, "void")}
                      >
                        Void
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canPaid || pending}
                        onClick={() => openRequestActionConfirm(request, "paid")}
                      >
                        Mark paid
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!requests.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-600">
                  {loading ? "Loading payout queue..." : "No cashout requests found for this filter."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {toast}
        </div>
      ) : null}

      {triageRequest ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            className="h-full flex-1 bg-slate-900/50"
            aria-label="Close triage panel"
            onClick={() => setTriageRequest(null)}
          />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Cashout triage</h2>
                <p className="text-xs text-slate-600">Request {triageRequest.id}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setTriageRequest(null)}>
                Close
              </Button>
            </div>

            <section className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                Requester:{" "}
                <span className="font-semibold">
                  {triageRequest.user.full_name || triageRequest.user.id}
                </span>
              </p>
              <p>
                Country: <span className="font-semibold">{triageRequest.country_code}</span>
              </p>
              <p>
                Credits/Cash:{" "}
                <span className="font-semibold">
                  {triageRequest.credits_requested} ·{" "}
                  {formatCurrency(triageRequest.cash_amount, triageRequest.currency)}
                </span>
              </p>
              <p>
                Status:{" "}
                <span className="font-semibold">{triageRequest.queue_status.toUpperCase()}</span> · Requested:{" "}
                <span className="font-semibold">{formatDate(triageRequest.requested_at)}</span>
              </p>
            </section>

            <section className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Risk summary</p>
              <p>
                Level:{" "}
                <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", riskChipClass(triageRequest.risk_level))}>
                  {triageRequest.risk_level === "none" ? "None" : triageRequest.risk_level}
                </span>
              </p>
              <div className="flex flex-wrap gap-1">
                {triageRequest.risk_flags.length ? (
                  triageRequest.risk_flags.map((flag) => (
                    <span
                      key={flag}
                      className="inline-flex rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                    >
                      {flag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-600">No risk flags</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p>Captures (1h): {triageRequest.risk_stats.captures_1h}</p>
                <p>Captures (24h): {triageRequest.risk_stats.captures_24h}</p>
                <p>Distinct IPs (24h): {triageRequest.risk_stats.distinct_ip_hash_24h}</p>
                <p>Distinct UAs (24h): {triageRequest.risk_stats.distinct_ua_hash_24h}</p>
                <p>Geo mismatches (24h): {triageRequest.risk_stats.geo_mismatch_count_24h}</p>
                <p>Deep refs (30d): {triageRequest.risk_stats.deep_referrals_30d}</p>
              </div>
            </section>

            <section className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Quick links</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={buildAdminReferralAttributionContextUrl({
                    referrerUserId: triageRequest.user_id,
                    requestedAt: triageRequest.requested_at,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  View context
                </a>
                <a
                  href={`/admin/users?q=${encodeURIComponent(triageRequest.user_id)}`}
                  className="inline-flex items-center rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Open user profile
                </a>
              </div>
            </section>

            <section className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Actions</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={triageRequest.status !== "pending" || pending}
                  onClick={() => {
                    openRequestActionConfirm(triageRequest, "approve");
                    setTriageRequest(null);
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={triageRequest.status !== "pending" || pending}
                  onClick={() => {
                    openRequestActionConfirm(triageRequest, "reject");
                    setTriageRequest(null);
                  }}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!(triageRequest.status === "pending" || triageRequest.status === "approved") || pending}
                  onClick={() => {
                    openRequestActionConfirm(triageRequest, "void");
                    setTriageRequest(null);
                  }}
                >
                  Void
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={triageRequest.status !== "approved" || pending}
                  onClick={() => {
                    openRequestActionConfirm(triageRequest, "paid");
                    setTriageRequest(null);
                  }}
                >
                  Mark paid
                </Button>
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {confirmState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">{confirmState.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{confirmState.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              This action updates the selected cashout request status and writes an append-only admin
              audit entry.
            </p>

            {(confirmState.requiresReason || confirmState.action === "bulk_reject" || confirmState.action === "reject" || confirmState.action === "approve") ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reason template
                </p>
                <Select value={reasonTemplate} onChange={(event) => setReasonTemplate(event.target.value)}>
                  <option value="">Choose a template</option>
                  {REASON_TEMPLATES.map((template) => (
                    <option key={template} value={template}>
                      {template}
                    </option>
                  ))}
                </Select>
                <Input
                  value={reasonText}
                  onChange={(event) => setReasonText(event.target.value)}
                  placeholder="Reason"
                  aria-label="Reason"
                />
              </div>
            ) : null}

            {confirmState.action === "paid" ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payout reference
                </p>
                <Input
                  value={payoutReference}
                  onChange={(event) => setPayoutReference(event.target.value)}
                  placeholder="Bank transfer / settlement reference"
                  aria-label="Payout reference"
                />
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmState(null)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="button" onClick={executeConfirm} disabled={pending}>
                {pending ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
