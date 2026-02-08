"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/date/relative-time";

const LEGAL_COPY =
  "This agreement is between agents. PropatyHub does not enforce or process commission payments.";

type AgreementRow = {
  id: string;
  listing_id: string;
  owner_agent_id: string;
  presenting_agent_id: string;
  commission_type?: string | null;
  commission_value?: number | null;
  currency?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  terms_locked?: boolean | null;
  terms_locked_at?: string | null;
};

type ListingRow = {
  id: string;
  title?: string | null;
  city?: string | null;
  price?: number | null;
  currency?: string | null;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
};

type EventRow = {
  agreement_id: string;
  event?: string | null;
  created_at?: string | null;
};

type Props = {
  agreements: AgreementRow[];
  listings: ListingRow[];
  profiles: ProfileRow[];
  events: EventRow[];
  viewerId: string;
};

type Section = {
  key: "proposed" | "accepted" | "declined" | "void";
  label: string;
};

const SECTIONS: Section[] = [
  { key: "proposed", label: "Proposed" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
  { key: "void", label: "Voided" },
];

function resolveName(profile?: ProfileRow | null) {
  return profile?.display_name || profile?.full_name || profile?.business_name || "Agent";
}

function formatCurrency(value?: number | null, currency?: string | null) {
  if (value == null) return null;
  return `${currency || "NGN"} ${value}`;
}

function formatCommission(agreement: AgreementRow) {
  if (agreement.commission_type === "none") return "None";
  if (agreement.commission_type === "percentage") {
    return agreement.commission_value != null ? `${agreement.commission_value}%` : "Percentage";
  }
  if (agreement.commission_type === "fixed") {
    return formatCurrency(agreement.commission_value, agreement.currency) || "Fixed";
  }
  return "—";
}

export default function AgentCollaborationsClient({
  agreements,
  listings,
  profiles,
  events,
  viewerId,
}: Props) {
  const [rows, setRows] = useState(agreements);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const listingMap = useMemo(
    () => new Map(listings.map((row) => [row.id, row])),
    [listings]
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((row) => [row.id, row])),
    [profiles]
  );
  const eventMap = useMemo(() => {
    const map = new Map<string, EventRow>();
    for (const event of events) {
      if (!map.has(event.agreement_id)) {
        map.set(event.agreement_id, event);
      }
    }
    return map;
  }, [events]);

  const updateStatus = async (
    id: string,
    status: "accepted" | "declined" | "void",
    reason?: string
  ) => {
    setSavingId(id);
    try {
      const response = await fetch(`/api/agent/commission-agreements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, void_reason: reason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update agreement.");
      }
      const updated = data?.agreement as AgreementRow | undefined;
      if (updated) {
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updated } : row)));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSavingId(null);
    }
  };

  const openVoidModal = (id: string) => {
    setVoidError(null);
    setVoidReason("");
    setVoidingId(id);
  };

  const closeVoidModal = () => {
    setVoidError(null);
    setVoidReason("");
    setVoidingId(null);
  };

  const submitVoid = async () => {
    if (!voidingId) return;
    if (voidReason.trim().length < 10) {
      setVoidError("Please add at least 10 characters.");
      return;
    }
    await updateStatus(voidingId, "void", voidReason.trim());
    closeVoidModal();
  };

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No commission agreements yet. Agreements will appear when you add external listings to
        a client page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => {
        const filtered = rows.filter((row) => (row.status || "proposed") === section.key);
        if (!filtered.length) return null;
        return (
          <div key={section.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">{section.label}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {filtered.length}
              </span>
            </div>
            <div className="space-y-3">
              {filtered.map((agreement) => {
                const listing = listingMap.get(agreement.listing_id);
                const owner = profileMap.get(agreement.owner_agent_id);
                const presenting = profileMap.get(agreement.presenting_agent_id);
                const isOwner = agreement.owner_agent_id === viewerId;
                const lastEvent = eventMap.get(agreement.id);
                const status = agreement.status || "proposed";
                return (
                  <div
                    key={agreement.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    data-testid={`commission-row-${agreement.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Listing</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">
                          {listing?.title || "Shared listing"}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {listing?.city || "Location"} · {formatCurrency(listing?.price, listing?.currency) || "Price"}
                        </p>
                        <p className="mt-2 text-xs text-slate-600">
                          Owner: <span className="font-semibold text-slate-700">{resolveName(owner)}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Presented by: <span className="font-semibold text-slate-700">{resolveName(presenting)}</span>
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p className="font-semibold text-slate-600">{formatCommission(agreement)}</p>
                        <p className="capitalize">{status}</p>
                        {agreement.created_at && (
                          <p className="mt-1">{formatRelativeTime(agreement.created_at)}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
                      {agreement.accepted_at && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                          Accepted {formatRelativeTime(agreement.accepted_at)}
                        </span>
                      )}
                      {agreement.declined_at && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                          Declined {formatRelativeTime(agreement.declined_at)}
                        </span>
                      )}
                      {agreement.voided_at && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                          Voided {formatRelativeTime(agreement.voided_at)}
                        </span>
                      )}
                    </div>
                    {agreement.notes && (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                        {agreement.notes}
                      </div>
                    )}
                    {agreement.void_reason && (
                      <div className="mt-2 text-xs text-slate-500">Void reason: {agreement.void_reason}</div>
                    )}
                    {lastEvent && (
                      <div className="mt-3 text-xs text-slate-500">
                        Outcome: {lastEvent.event === "deal_marked_won" ? "Won" : "Lost"}
                        {lastEvent.created_at ? ` · ${formatRelativeTime(lastEvent.created_at)}` : ""}
                      </div>
                    )}
                    <div className="mt-3 text-[11px] text-slate-400">{LEGAL_COPY}</div>
                    <div className="mt-3">
                      <Link
                        href={`/dashboard/collaborations/${agreement.id}`}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                      >
                        View agreement summary
                      </Link>
                    </div>
                    {isOwner && status === "proposed" && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateStatus(agreement.id, "accepted")}
                          data-testid={`commission-accept-${agreement.id}`}
                          disabled={savingId === agreement.id}
                        >
                          {savingId === agreement.id ? "Updating" : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateStatus(agreement.id, "declined")}
                          data-testid={`commission-decline-${agreement.id}`}
                          disabled={savingId === agreement.id}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                    {isOwner && status === "accepted" && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openVoidModal(agreement.id)}
                          data-testid={`commission-void-${agreement.id}`}
                          disabled={savingId === agreement.id}
                        >
                          Void agreement
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {voidingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Void agreement</p>
                <p className="text-xs text-slate-500">Add a short reason for auditing purposes.</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500"
                onClick={closeVoidModal}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                rows={4}
                placeholder="Reason for voiding"
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                data-testid="commission-void-reason"
              />
              {voidError && <p className="text-xs text-rose-600">{voidError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <Button size="sm" variant="secondary" onClick={closeVoidModal}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitVoid} data-testid="commission-void-confirm">
                Confirm void
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
