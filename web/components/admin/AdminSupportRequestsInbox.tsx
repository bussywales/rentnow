"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type SupportRequestItem = {
  id: string;
  createdAt: string | null;
  category: string;
  email: string | null;
  name: string | null;
  status: string;
  role: string | null;
  message: string;
  excerpt: string;
  escalated: boolean;
  metadata: Record<string, unknown>;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  claimedBy: string | null;
  claimedAt: string | null;
  resolvedAt: string | null;
  ageMinutes: number;
  slaMinutes: number | null;
  isOverdue: boolean;
};

type SupportRequestsResponse = {
  ok: boolean;
  items: SupportRequestItem[];
  pagination: {
    total: number;
    hasMore: boolean;
  };
};

function formatTime(value: string | null) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAgeMinutes(value: number) {
  const minutes = Math.max(0, Math.floor(Number(value || 0)));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function AdminSupportRequestsInbox() {
  const [status, setStatus] = useState<"open" | "all" | "new" | "in_progress" | "resolved">("open");
  const [escalatedOnly, setEscalatedOnly] = useState(true);
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SupportRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<SupportRequestItem | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [overdueFirst, setOverdueFirst] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", status);
    if (assignedToMe) params.set("assigned", "me");
    if (escalatedOnly) params.set("escalated", "1");
    params.set("limit", "30");
    params.set("offset", "0");
    return params.toString();
  }, [assignedToMe, escalatedOnly, status]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/requests?${queryString}`, {
        signal,
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as SupportRequestsResponse | { error?: string } | null;
      if (!response.ok) {
        setError((body as { error?: string } | null)?.error || "Unable to load support requests.");
        setRows([]);
        setTotal(0);
        return;
      }
      const payload = body as SupportRequestsResponse;
      setRows(Array.isArray(payload.items) ? payload.items : []);
      setTotal(payload.pagination?.total ?? 0);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(requestError instanceof Error ? requestError.message : "Unable to load support requests.");
      setRows([]);
      setTotal(0);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [queryString]);

  const claimRequest = useCallback(
    async (rowId: string) => {
      setMutatingId(rowId);
      setError(null);
      try {
        const response = await fetch(`/api/admin/support/requests/${encodeURIComponent(rowId)}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error || "Unable to claim support request.");
          return;
        }
        await load();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to claim support request.");
      } finally {
        setMutatingId(null);
      }
    },
    [load]
  );

  const updateRequestStatus = useCallback(
    async (rowId: string, nextStatus: "new" | "in_progress" | "resolved") => {
      setMutatingId(rowId);
      setError(null);
      try {
        const response = await fetch(`/api/admin/support/requests/${encodeURIComponent(rowId)}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error || "Unable to update support request status.");
          return;
        }
        await load();
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : "Unable to update support request status."
        );
      } finally {
        setMutatingId(null);
      }
    },
    [load]
  );

  const selectedStatus = (selected?.status || "new").toLowerCase() as "new" | "in_progress" | "resolved";
  const sortedRows = useMemo(() => {
    if (!overdueFirst) return rows;
    return [...rows].sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const aCreated = Date.parse(a.createdAt || "");
      const bCreated = Date.parse(b.createdAt || "");
      if (!Number.isFinite(aCreated) && !Number.isFinite(bCreated)) return 0;
      if (!Number.isFinite(aCreated)) return 1;
      if (!Number.isFinite(bCreated)) return -1;
      return bCreated - aCreated;
    });
  }, [overdueFirst, rows]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid="admin-support-inbox"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">AI escalations inbox</h3>
          <p className="text-sm text-slate-600">
            Newest support requests with escalation signal, metadata, and transcript context.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void load()}
          data-testid="admin-support-refresh"
        >
          Refresh
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-600">Status</span>
          <select
            value={status}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "all" ||
                value === "open" ||
                value === "new" ||
                value === "in_progress" ||
                value === "resolved"
              ) {
                setStatus(value);
              } else {
                setStatus("open");
              }
            }}
            className="rounded-md border border-slate-200 px-2 py-1"
            data-testid="admin-support-status-filter"
          >
            <option value="open">Open</option>
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={escalatedOnly}
            onChange={(event) => setEscalatedOnly(event.target.checked)}
            data-testid="admin-support-escalated-filter"
          />
          Escalated only
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={assignedToMe}
            onChange={(event) => setAssignedToMe(event.target.checked)}
            data-testid="admin-support-assigned-filter"
          />
          Assigned to me
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={overdueFirst}
            onChange={(event) => setOverdueFirst(event.target.checked)}
            data-testid="admin-support-overdue-sort"
          />
          Overdue first
        </label>
        <span className="text-xs text-slate-500">Total: {total}</span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading support requests…</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No requests match this filter yet.</p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm" data-testid="admin-support-table">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Age</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Excerpt</th>
                <th className="px-2 py-2">Flags</th>
                <th className="px-2 py-2">Assignee</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody data-testid="admin-support-rows">
              {sortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 align-top"
                  data-testid="admin-support-row"
                >
                  <td className="px-2 py-2 text-xs text-slate-600">{formatTime(row.createdAt)}</td>
                  <td className="px-2 py-2 text-xs text-slate-700" data-testid="admin-support-age">
                    {formatAgeMinutes(row.ageMinutes)}
                  </td>
                  <td className="px-2 py-2">{categoryLabel(row.category)}</td>
                  <td className="px-2 py-2">{row.role || "unknown"}</td>
                  <td className="px-2 py-2">{row.email || "n/a"}</td>
                  <td className="max-w-[340px] px-2 py-2 text-slate-700">{row.excerpt || "—"}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.escalated ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Escalated
                        </span>
                      ) : null}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {row.status}
                      </span>
                      {row.isOverdue ? (
                        <span
                          className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700"
                          data-testid="admin-support-overdue-badge"
                        >
                          Overdue
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">
                    {row.claimedBy ? `Assigned` : "Unassigned"}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(row)}>
                        View
                      </Button>
                      {!row.claimedBy && row.status.toLowerCase() !== "resolved" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={mutatingId === row.id}
                          onClick={() => void claimRequest(row.id)}
                          data-testid="admin-support-claim"
                        >
                          Claim
                        </Button>
                      ) : null}
                      <select
                        value={(row.status || "new").toLowerCase()}
                        onChange={(event) =>
                          void updateRequestStatus(
                            row.id,
                            event.target.value as "new" | "in_progress" | "resolved"
                          )
                        }
                        disabled={mutatingId === row.id}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        data-testid="admin-support-status-action"
                      >
                        <option value="new">New</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-[80]" data-testid="admin-support-drawer">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close support request drawer"
            onClick={() => setSelected(null)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[540px] overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Support request</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">{selected.id}</h4>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Created:</span> {formatTime(selected.createdAt)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Category:</span> {categoryLabel(selected.category)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Role:</span> {selected.role || "unknown"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Email:</span> {selected.email || "n/a"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Status:</span> {selected.status}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Claim:</span>{" "}
                {selected.claimedBy ? "Assigned" : "Unassigned"}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {!selected.claimedBy && selectedStatus !== "resolved" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={mutatingId === selected.id}
                  onClick={() => void claimRequest(selected.id)}
                  data-testid="admin-support-drawer-claim"
                >
                  Claim
                </Button>
              ) : null}
              <select
                value={selectedStatus}
                onChange={async (event) => {
                  const nextStatus = event.target.value as "new" | "in_progress" | "resolved";
                  await updateRequestStatus(selected.id, nextStatus);
                }}
                disabled={mutatingId === selected.id}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                data-testid="admin-support-drawer-status-action"
              >
                <option value="new">New</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Message</p>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                {selected.message || "n/a"}
              </pre>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Metadata</p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {JSON.stringify(selected.metadata || {}, null, 2)}
              </pre>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI transcript</p>
              {selected.transcript.length ? (
                <ul className="mt-2 space-y-2">
                  {selected.transcript.map((item, index) => (
                    <li key={`${item.role}:${index}`} className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
                      <p className="text-xs font-semibold uppercase text-slate-500">{item.role}</p>
                      <p className="mt-1 text-slate-700">{item.content}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No transcript attached.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
