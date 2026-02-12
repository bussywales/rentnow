"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import {
  durationLabel,
  isFeaturedRequestStale,
  type FeaturedRequestDuration,
  type FeaturedRequestStatus,
} from "@/lib/featured/requests";

type FeaturedRequestRow = {
  id: string;
  property_id: string;
  requester_user_id: string;
  requester_role: "agent" | "landlord";
  duration_days: FeaturedRequestDuration;
  requested_until: string | null;
  note: string | null;
  status: FeaturedRequestStatus;
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  property: {
    id: string;
    title: string;
    city: string | null;
    price: number | null;
    currency: string | null;
    status: string | null;
    is_active: boolean | null;
    is_approved: boolean | null;
    expires_at: string | null;
    is_demo: boolean | null;
    is_featured: boolean | null;
    featured_until: string | null;
  } | null;
  requester: {
    id: string;
    full_name: string | null;
  };
};

type Props = {
  initialRequests: FeaturedRequestRow[];
};

type ConfirmState = null | {
  mode: "single" | "bulk";
  action: "approve" | "reject";
  ids: string[];
  title: string;
  description: string;
};

const STATUS_OPTIONS: Array<{ value: FeaturedRequestStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const TIMEFRAME_OPTIONS: Array<{ value: "7d" | "30d" | "all"; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

const REASON_TEMPLATES = [
  "Inventory quality not ready",
  "Listing policy mismatch",
  "Manual moderation hold",
  "Duplicate request",
  "Promotion criteria not met",
  "Stale request — please re-submit if still needed.",
];

function statusChipClass(status: FeaturedRequestStatus) {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "rejected") return "bg-rose-100 text-rose-800";
  return "bg-slate-200 text-slate-700";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatCurrency(value: number | null | undefined, currency: string | null | undefined): string {
  if (value === null || typeof value === "undefined") return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildQueryString(filters: {
  status: FeaturedRequestStatus | "all";
  timeframe: "7d" | "30d" | "all";
  q: string;
}) {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.timeframe !== "30d") params.set("timeframe", filters.timeframe);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return params.toString();
}

function parseDuration(value: string): FeaturedRequestDuration {
  if (value === "7") return 7;
  if (value === "30") return 30;
  return null;
}

export default function AdminFeaturedRequestsQueue({ initialRequests }: Props) {
  const [requests, setRequests] = useState<FeaturedRequestRow[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<FeaturedRequestStatus | "all">("pending");
  const [timeframeFilter, setTimeframeFilter] = useState<"7d" | "30d" | "all">("30d");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [reasonTemplate, setReasonTemplate] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [durationValue, setDurationValue] = useState<"7" | "30" | "none">("7");
  const [featuredRank, setFeaturedRank] = useState("");
  const [pending, startTransition] = useTransition();

  const queryString = useMemo(
    () =>
      buildQueryString({
        status: statusFilter,
        timeframe: timeframeFilter,
        q: search,
      }),
    [statusFilter, timeframeFilter, search]
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/featured/requests${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Unable to load featured requests."));
        return;
      }
      setRequests(Array.isArray(payload.requests) ? payload.requests : []);
      setSelectedIds(new Set());
    } catch {
      setError("Unable to load featured requests.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const allSelected = useMemo(
    () => requests.length > 0 && requests.every((row) => selectedIds.has(row.id)),
    [requests, selectedIds]
  );

  const selectedRows = useMemo(
    () => requests.filter((row) => selectedIds.has(row.id)),
    [requests, selectedIds]
  );

  const selectedHasNonPending = selectedRows.some((row) => row.status !== "pending");

  const openConfirm = (
    state: NonNullable<ConfirmState>,
    options?: { duration?: "7" | "30" | "none"; note?: string; rank?: string; template?: string }
  ) => {
    setConfirmState(state);
    setDurationValue(options?.duration ?? "7");
    setAdminNote(options?.note ?? "");
    setReasonTemplate(options?.template ?? "");
    setFeaturedRank(options?.rank ?? "");
  };

  const runSingleAction = async (
    id: string,
    action: "approve" | "reject",
    payload: { adminNote: string | null; durationDays: FeaturedRequestDuration; featuredRank: number | null }
  ) => {
    const response = await fetch(`/api/admin/featured/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        adminNote: payload.adminNote,
        durationDays: action === "approve" ? payload.durationDays : undefined,
        featuredRank: action === "approve" ? payload.featuredRank : undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error || "Unable to process request.");
    }
  };

  const executeConfirm = () => {
    if (!confirmState) return;

    const reasonText = String(adminNote || reasonTemplate || "").trim();
    if (confirmState.action === "reject" && !reasonText) {
      setError("Reason is required for rejection.");
      return;
    }

    const durationDays = parseDuration(durationValue);
    const rankValue = featuredRank.trim() ? Number(featuredRank.trim()) : null;
    if (confirmState.action === "approve" && rankValue !== null && (!Number.isFinite(rankValue) || rankValue < 0)) {
      setError("Rank must be a valid non-negative number.");
      return;
    }

    setError(null);
    setToast(null);

    startTransition(async () => {
      try {
        if (confirmState.mode === "bulk") {
          for (const id of confirmState.ids) {
            await runSingleAction(id, confirmState.action, {
              adminNote: reasonText || null,
              durationDays,
              featuredRank: null,
            });
          }
          setToast(
            confirmState.action === "approve"
              ? `Approved ${confirmState.ids.length} request(s).`
              : `Rejected ${confirmState.ids.length} request(s).`
          );
        } else {
          await runSingleAction(confirmState.ids[0], confirmState.action, {
            adminNote: reasonText || null,
            durationDays,
            featuredRank: rankValue,
          });
          setToast(confirmState.action === "approve" ? "Request approved." : "Request rejected.");
        }

        setConfirmState(null);
        setSelectedIds(new Set());
        await loadRequests();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to process request.");
      }
    });
  };

  const exportHref = `/api/admin/featured/requests/export.csv${queryString ? `?${queryString}` : ""}`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-featured-requests-queue">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Featured requests queue</h2>
            <p className="text-sm text-slate-600">Approve or reject host requests for featured placement.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={exportHref}
              className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </a>
            <Button size="sm" variant="secondary" onClick={() => void loadRequests()} disabled={loading || pending}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  statusFilter === option.value
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeframeFilter(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  timeframeFilter === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                )}
              >
                {option.label}
              </button>
            ))}
            <div className="min-w-[220px] flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by listing, request, or requester"
                aria-label="Search featured requests"
              />
            </div>
          </div>
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>{selectedIds.size} selected</span>
            <Button
              size="sm"
              onClick={() =>
                openConfirm({
                  mode: "bulk",
                  action: "approve",
                  ids: Array.from(selectedIds),
                  title: "Bulk approve requests",
                  description: "Approve selected pending requests.",
                })
              }
              disabled={pending || selectedHasNonPending}
            >
              Bulk approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                openConfirm({
                  mode: "bulk",
                  action: "reject",
                  ids: Array.from(selectedIds),
                  title: "Bulk reject requests",
                  description: "Reject selected pending requests with a reason.",
                })
              }
              disabled={pending || selectedHasNonPending}
            >
              Bulk reject
            </Button>
            {selectedHasNonPending ? (
              <span className="text-xs text-amber-800">Bulk actions are only available for pending requests.</span>
            ) : null}
          </div>
        ) : null}

        {toast ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{toast}</div> : null}
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds(new Set(requests.map((row) => row.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    aria-label="Select all featured requests"
                  />
                </th>
                <th className="px-3 py-2">Property</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2">Requested duration</th>
                <th className="px-3 py-2">Requested by</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Requested at</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {requests.map((row) => {
                const pendingRow = row.status === "pending";
                const stalePending = pendingRow && isFeaturedRequestStale(row.created_at);
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={(event) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          });
                        }}
                        aria-label={`Select request ${row.id}`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold text-slate-900">{row.property?.title || "Listing unavailable"}</div>
                      <div className="text-xs text-slate-600">{row.property_id}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">{row.property?.city || "-"}</td>
                    <td className="px-3 py-2 align-top text-right text-slate-700 tabular-nums">
                      {formatCurrency(row.property?.price ?? null, row.property?.currency ?? "NGN")}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">
                      <div>{durationLabel(row.duration_days)}</div>
                      <div className="text-xs text-slate-500">
                        {row.requested_until ? `Until ${formatDate(row.requested_until)}` : "No expiry"}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">
                      <div className="font-semibold">{row.requester.full_name || row.requester_user_id.slice(0, 8)}</div>
                      <div className="text-xs text-slate-500">
                        {row.requester_role.toUpperCase()} · {row.requester_user_id.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600">{row.note || "-"}</td>
                    <td className="px-3 py-2 align-top">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", statusChipClass(row.status))}>
                        {row.status}
                      </span>
                      {stalePending ? (
                        <div className="mt-1">
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Stale
                          </span>
                        </div>
                      ) : null}
                      {row.admin_note ? <div className="mt-1 text-xs text-slate-500">{row.admin_note}</div> : null}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600">
                      <div>{formatDate(row.created_at)}</div>
                      {row.decided_at ? <div className="text-xs text-slate-500">Decided {formatDate(row.decided_at)}</div> : null}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      {pendingRow ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              openConfirm(
                                {
                                  mode: "single",
                                  action: "approve",
                                  ids: [row.id],
                                  title: "Approve featured request",
                                  description: "Set duration and optional rank.",
                                },
                                {
                                  duration:
                                    row.duration_days === 30 ? "30" : row.duration_days === null ? "none" : "7",
                                }
                              )
                            }
                            disabled={pending}
                            data-testid={`featured-request-approve-${row.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              openConfirm(
                                {
                                  mode: "single",
                                  action: "reject",
                                  ids: [row.id],
                                  title: "Reject featured request",
                                  description: "Provide a reason for the requester.",
                                },
                                { note: row.admin_note || "" }
                              )
                            }
                            disabled={pending}
                            data-testid={`featured-request-reject-${row.id}`}
                          >
                            Reject
                          </Button>
                          {stalePending ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                openConfirm(
                                  {
                                    mode: "single",
                                    action: "reject",
                                    ids: [row.id],
                                    title: "Reject stale featured request",
                                    description:
                                      "Reject this stale pending request and ask the host to re-submit if still needed.",
                                  },
                                  {
                                    template: "Stale request — please re-submit if still needed.",
                                    note: "Stale request — please re-submit if still needed.",
                                  }
                                )
                              }
                              disabled={pending}
                              data-testid={`featured-request-reject-stale-${row.id}`}
                            >
                              Reject (stale)
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!requests.length ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-600">
                    {loading ? "Loading requests…" : "No featured requests found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {confirmState ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setConfirmState(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{confirmState.title}</h3>
            <p className="mt-2 text-sm text-slate-700">{confirmState.description}</p>

            {confirmState.action === "approve" ? (
              <div className="mt-4 space-y-3">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Duration</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "7", label: "7 days" },
                    { value: "30", label: "30 days" },
                    { value: "none", label: "No expiry" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDurationValue(option.value as "7" | "30" | "none")}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold",
                        durationValue === option.value
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                      disabled={pending}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {confirmState.mode === "single" ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="featured-rank">
                      Featured rank (optional)
                    </label>
                    <Input
                      id="featured-rank"
                      type="number"
                      min={0}
                      value={featuredRank}
                      onChange={(event) => setFeaturedRank(event.target.value)}
                      placeholder="e.g. 1"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Reason template</label>
                  <Select
                    value={reasonTemplate}
                    onChange={(event) => {
                      setReasonTemplate(event.target.value);
                      if (!adminNote.trim()) {
                        setAdminNote(event.target.value);
                      }
                    }}
                  >
                    <option value="">Choose template</option>
                    {REASON_TEMPLATES.map((template) => (
                      <option key={template} value={template}>
                        {template}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="featured-admin-note">
                Admin note
              </label>
              <textarea
                id="featured-admin-note"
                rows={3}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder={confirmState.action === "reject" ? "Reason required" : "Optional note"}
                maxLength={1000}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirmState(null)} disabled={pending}>
                Cancel
              </Button>
              <Button size="sm" onClick={executeConfirm} disabled={pending}>
                {pending ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
