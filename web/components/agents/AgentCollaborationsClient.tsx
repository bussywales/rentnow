"use client";

import { useMemo, useState } from "react";
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

  const updateStatus = async (id: string, status: "accepted" | "declined" | "void") => {
    setSavingId(id);
    try {
      const response = await fetch(`/api/agent/commission-agreements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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
                return (
                  <div
                    key={agreement.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
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
                        <p>{agreement.status || "proposed"}</p>
                        {agreement.created_at && (
                          <p className="mt-1">{formatRelativeTime(agreement.created_at)}</p>
                        )}
                      </div>
                    </div>
                    {agreement.notes && (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                        {agreement.notes}
                      </div>
                    )}
                    {lastEvent && (
                      <div className="mt-3 text-xs text-slate-500">
                        Outcome: {lastEvent.event === "deal_marked_won" ? "Won" : "Lost"}
                        {lastEvent.created_at ? ` · ${formatRelativeTime(lastEvent.created_at)}` : ""}
                      </div>
                    )}
                    <div className="mt-3 text-[11px] text-slate-400">{LEGAL_COPY}</div>
                    {isOwner && agreement.status === "proposed" && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateStatus(agreement.id, "accepted")}
                          disabled={savingId === agreement.id}
                        >
                          {savingId === agreement.id ? "Updating" : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateStatus(agreement.id, "declined")}
                          disabled={savingId === agreement.id}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                    {isOwner && agreement.status === "accepted" && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateStatus(agreement.id, "void")}
                          disabled={savingId === agreement.id}
                        >
                          Mark void
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
    </div>
  );
}
