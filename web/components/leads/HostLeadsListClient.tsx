"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { LeadStatus } from "@/lib/leads/types";

type LeadRow = {
  id: string;
  thread_id?: string | null;
  status: LeadStatus;
  created_at?: string | null;
  intent?: string | null;
  properties?: { title?: string | null; city?: string | null; state_region?: string | null } | null;
  buyer?: { id?: string | null; full_name?: string | null } | null;
};

type Props = {
  leads: LeadRow[];
  error?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatLocation(lead: LeadRow) {
  const city = lead.properties?.city ?? "";
  const region = lead.properties?.state_region ?? "";
  return [city, region].filter(Boolean).join(", ");
}

export function HostLeadsListClient({ leads, error }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleOpen = async (lead: LeadRow) => {
    if (!lead.thread_id) return;
    if (lead.status === "NEW") {
      setPendingId(lead.id);
      try {
        await fetch(`/api/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONTACTED" }),
        });
      } catch {
        // best-effort status update
      } finally {
        setPendingId(null);
      }
    }
    router.push(`/dashboard/messages?thread=${lead.thread_id}`);
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {error}
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No enquiries yet. Leads submitted for buy listings will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((lead) => {
        const isNew = lead.status === "NEW";
        const title = lead.properties?.title ?? "Listing";
        return (
          <div
            key={lead.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                  {isNew && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      New
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{formatLocation(lead)}</p>
                <p className="text-xs text-slate-500">
                  Buyer: {lead.buyer?.full_name || lead.buyer?.id || "Unknown"}
                </p>
                <p className="text-xs text-slate-400">{formatDate(lead.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  {lead.status}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleOpen(lead)}
                  disabled={!lead.thread_id || pendingId === lead.id}
                >
                  {pendingId === lead.id ? "Opening..." : "Open"}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
