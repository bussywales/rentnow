"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type QueueRequest = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  rate_used: number;
  status: "pending" | "approved" | "rejected" | "paid" | "void";
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
};

type Props = {
  initialRequests: QueueRequest[];
};

type RowDraft = {
  admin_note: string;
  payout_reference: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(Math.max(0, Number(value || 0)));
}

async function patchRequest(
  id: string,
  payload: {
    action: "approve" | "reject" | "paid" | "void";
    admin_note?: string | null;
    payout_reference?: string | null;
  }
) {
  const response = await fetch(`/api/admin/referrals/cashouts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(json?.reason || json?.error || "Unable to update cashout request.");
  }
  return json;
}

export default function AdminReferralPayoutQueue({ initialRequests }: Props) {
  const [requests, setRequests] = useState<QueueRequest[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<"all" | QueueRequest["status"]>("all");
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() =>
    Object.fromEntries(
      initialRequests.map((row) => [
        row.id,
        {
          admin_note: row.admin_note || "",
          payout_reference: row.payout_reference || "",
        },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const setDraft = (id: string, patch: Partial<RowDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        admin_note: current[id]?.admin_note || "",
        payout_reference: current[id]?.payout_reference || "",
        ...patch,
      },
    }));
  };

  const updateStatus = (id: string, action: "approve" | "reject" | "paid" | "void") => {
    const draft = drafts[id] || { admin_note: "", payout_reference: "" };
    setError(null);
    setToast(null);

    startTransition(async () => {
      try {
        const result = await patchRequest(id, {
          action,
          admin_note: draft.admin_note.trim() || null,
          payout_reference: draft.payout_reference.trim() || null,
        });

        const nextStatus = String(result.status || action) as QueueRequest["status"];
        setRequests((current) =>
          current.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status: nextStatus,
                  admin_note: draft.admin_note || null,
                  payout_reference:
                    action === "paid" ? draft.payout_reference || row.payout_reference : row.payout_reference,
                  decided_at:
                    nextStatus === "approved" || nextStatus === "rejected" || nextStatus === "void"
                      ? new Date().toISOString()
                      : row.decided_at,
                  paid_at: nextStatus === "paid" ? new Date().toISOString() : row.paid_at,
                }
              : row
          )
        );

        setToast(`Request ${nextStatus}.`);
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "Unable to update request.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Referral cashout payouts</h1>
          <p className="text-sm text-slate-600">
            Manual approval queue. No external payout provider is connected yet.
          </p>
        </div>
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | QueueRequest["status"])
            }
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="void">Voided</option>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {filteredRequests.length ? (
            filteredRequests.map((request) => {
              const draft = drafts[request.id] || { admin_note: "", payout_reference: "" };
              const canApprove = request.status === "pending";
              const canReject = request.status === "pending" || request.status === "approved";
              const canVoid = request.status === "pending" || request.status === "approved";
              const canMarkPaid = request.status === "approved";

              return (
                <div key={request.id} className="space-y-3 px-4 py-4" data-testid="admin-referrals-cashout-row">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {request.user.full_name || request.user.email || request.user.id}
                      </p>
                      <p className="text-xs text-slate-600">{request.user.email || request.user.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {request.credits_requested} credits · {formatCurrency(request.cash_amount, request.currency)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {request.country_code} · {request.status.toUpperCase()} · Requested {formatDate(request.requested_at)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 lg:grid-cols-[1fr_220px_auto]">
                    <Input
                      value={draft.admin_note}
                      onChange={(event) =>
                        setDraft(request.id, { admin_note: event.target.value })
                      }
                      placeholder="Admin note"
                    />
                    <Input
                      value={draft.payout_reference}
                      onChange={(event) =>
                        setDraft(request.id, { payout_reference: event.target.value })
                      }
                      placeholder="Payout reference"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canApprove || pending}
                        onClick={() => updateStatus(request.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!canReject || pending}
                        onClick={() => updateStatus(request.id, "reject")}
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!canVoid || pending}
                        onClick={() => updateStatus(request.id, "void")}
                      >
                        Void
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canMarkPaid || pending}
                        onClick={() => updateStatus(request.id, "paid")}
                      >
                        Mark paid
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="px-4 py-6 text-sm text-slate-600">No cashout requests found for this filter.</p>
          )}
        </div>
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
    </div>
  );
}
