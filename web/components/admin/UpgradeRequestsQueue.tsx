"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type UpgradeRequest = {
  id: string;
  profile_id: string;
  requester_id: string;
  requested_plan_tier: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  resolved_at?: string | null;
};

type AdminUser = {
  id: string;
  full_name: string | null;
  role?: string | null;
};

type Props = {
  initialRequests: UpgradeRequest[];
  users: AdminUser[];
};

type FormState = {
  planTier: string;
  preset: string;
  customDate: string;
  note: string;
  status: "idle" | "loading" | "done" | "error";
  message?: string | null;
};

const statusPriority: Record<string, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
};

const planOptions = ["starter", "pro", "tenant_pro"] as const;

function addMonths(base: Date, months: number) {
  const date = new Date(base);
  date.setMonth(date.getMonth() + months);
  return date;
}

function computeValidUntil(preset: string, customDate: string) {
  if (customDate) return `${customDate}T23:59:59.999Z`;
  const now = new Date();
  if (preset === "1m") return addMonths(now, 1).toISOString();
  if (preset === "3m") return addMonths(now, 3).toISOString();
  if (preset === "1y") return addMonths(now, 12).toISOString();
  return null;
}

function resolveUserName(users: AdminUser[], id: string) {
  return users.find((user) => user.id === id)?.full_name || id;
}

export function UpgradeRequestsQueue({ initialRequests, users }: Props) {
  const [requests, setRequests] = useState<UpgradeRequest[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [planFilter, setPlanFilter] = useState("all");
  const [banner, setBanner] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, FormState>>({});

  const filtered = useMemo(() => {
    return requests
      .filter((request) => (statusFilter === "all" ? true : request.status === statusFilter))
      .filter((request) =>
        planFilter === "all" ? true : request.requested_plan_tier === planFilter
      )
      .sort((a, b) => {
        const priorityA = statusPriority[a.status] ?? 9;
        const priorityB = statusPriority[b.status] ?? 9;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [requests, statusFilter, planFilter]);

  const getState = (request: UpgradeRequest): FormState => {
    const current = formState[request.id];
    if (current) return current;
    return {
      planTier: request.requested_plan_tier || "starter",
      preset: "1m",
      customDate: "",
      note: "",
      status: "idle",
      message: null,
    };
  };

  const updateState = (id: string, patch: Partial<FormState>) => {
    setFormState((prev) => ({
      ...prev,
      [id]: { ...getState(requests.find((req) => req.id === id) as UpgradeRequest), ...patch },
    }));
  };

  const handleAction = async (request: UpgradeRequest, action: "approve" | "reject") => {
    const state = getState(request);
    const note = state.note.trim();

    if (action === "reject" && !note) {
      updateState(request.id, { status: "error", message: "Rejection reason is required." });
      return;
    }

    if (action === "approve" && !state.planTier) {
      updateState(request.id, { status: "error", message: "Choose a plan tier to approve." });
      return;
    }

    updateState(request.id, { status: "loading", message: null });
    const validUntil = action === "approve" ? computeValidUntil(state.preset, state.customDate) : null;

    const res = await fetch("/api/admin/upgrade-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: request.id,
        action,
        planTier: state.planTier,
        validUntil,
        note: note || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      updateState(request.id, {
        status: "error",
        message: data?.error || `Request failed (${res.status})`,
      });
      return;
    }

    setRequests((prev) =>
      prev.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: action === "approve" ? "approved" : "rejected",
              resolved_at: new Date().toISOString(),
              notes: note || item.notes,
            }
          : item
      )
    );

    updateState(request.id, { status: "done", message: "Updated." });
    setBanner(
      action === "approve"
        ? `Approved ${resolveUserName(users, request.requester_id)}.`
        : `Rejected request from ${resolveUserName(users, request.requester_id)}.`
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="upgrade-requests">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Upgrade requests</h2>
          <p className="text-sm text-slate-600">
            Manual billing requests from landlords, agents, and tenants.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="pending">Pending first</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All statuses</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
          >
            <option value="all">All tiers</option>
            {planOptions.map((plan) => (
              <option key={plan} value={plan}>
                {plan.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {banner && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {banner}
        </div>
      )}

      {!filtered.length && (
        <p className="text-sm text-slate-600">No upgrade requests found.</p>
      )}

      <div className="divide-y divide-slate-100 text-sm">
        {filtered.map((request) => {
          const requester = resolveUserName(users, request.requester_id);
          const state = getState(request);
          return (
            <div key={request.id} className="flex flex-col gap-3 py-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{requester}</p>
                  <p className="text-slate-600">
                    Requested: {request.requested_plan_tier || "starter"} • Status: {request.status}
                  </p>
                  {request.notes && (
                    <p className="text-xs text-slate-500">Notes: {request.notes}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    Created: {request.created_at?.replace("T", " ").replace("Z", "") || "—"}
                  </p>
                </div>
                {request.status !== "pending" && (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {request.status}
                  </span>
                )}
              </div>

              {request.status === "pending" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs text-slate-600">
                      Plan tier
                      <select
                        className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                        value={state.planTier}
                        onChange={(event) => updateState(request.id, { planTier: event.target.value })}
                        disabled={state.status === "loading"}
                      >
                        {planOptions.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-slate-600">
                      Valid until
                      <select
                        className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                        value={state.preset}
                        onChange={(event) => updateState(request.id, { preset: event.target.value, customDate: "" })}
                        disabled={state.status === "loading"}
                      >
                        <option value="1m">+1 month</option>
                        <option value="3m">+3 months</option>
                        <option value="1y">+1 year</option>
                        <option value="custom">Custom date</option>
                      </select>
                    </label>
                    {state.preset === "custom" && (
                      <label className="text-xs text-slate-600">
                        Date
                        <input
                          className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-xs"
                          type="date"
                          value={state.customDate}
                          onChange={(event) => updateState(request.id, { customDate: event.target.value })}
                          disabled={state.status === "loading"}
                        />
                      </label>
                    )}
                  </div>
                  <label className="mt-3 block text-xs text-slate-600">
                    Admin note / rejection reason
                    <textarea
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                      rows={2}
                      value={state.note}
                      onChange={(event) => updateState(request.id, { note: event.target.value })}
                      disabled={state.status === "loading"}
                    />
                  </label>
                  {state.message && <p className="mt-2 text-xs text-slate-600">{state.message}</p>}
                  {state.status === "error" && !state.message && (
                    <p className="mt-2 text-xs text-rose-600">Action failed.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => handleAction(request, "approve")}
                      disabled={state.status === "loading"}
                    >
                      {state.status === "loading" ? "Saving..." : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      onClick={() => handleAction(request, "reject")}
                      disabled={state.status === "loading"}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
