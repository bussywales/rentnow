"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ViewingStatusBadge } from "@/components/viewings/ViewingStatusBadge";

type Viewing = {
  id: string;
  property_id: string;
  status: string;
  preferred_times: string[];
  proposed_times?: string[] | null;
  approved_time?: string | null;
  host_message?: string | null;
  decline_reason_code?: string | null;
  message?: string | null;
  created_at: string;
  properties?: { title?: string | null; city?: string | null; neighbourhood?: string | null; timezone?: string | null } | null;
};

function formatTimes(times: string[], timeZone?: string | null) {
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone || undefined,
  });
  return times.map((t) => fmt.format(new Date(t))).join(" • ");
}

export function HostViewingsList() {
  const [loading, setLoading] = useState(true);
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, string>>({});
  const [proposedTimes, setProposedTimes] = useState<Record<string, string>>({});
  const [hostMessage, setHostMessage] = useState<Record<string, string>>({});
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/viewings/host", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || "Unable to load viewings");
          setViewings([]);
        } else {
          setViewings(json.viewings || []);
        }
      } catch (err) {
        console.error(err);
        setError("Unable to load viewings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRespond = async (id: string, action: "approve" | "propose" | "decline") => {
    const payload: Record<string, unknown> = {
      viewingRequestId: id,
      action,
      hostMessage: hostMessage[id] || undefined,
    };
    if (action === "approve") {
      payload.approvedTime = proposedTimes[id];
    } else if (action === "propose") {
      payload.proposedTimes = (proposedTimes[id] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (action === "decline") {
      payload.declineReasonCode = declineReason[id] || "other";
    }
    setActionState((prev) => ({ ...prev, [id]: "saving" }));
    try {
      const res = await fetch("/api/viewings/respond", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setActionState((prev) => ({ ...prev, [id]: "error" }));
      } else {
        setActionState((prev) => ({ ...prev, [id]: "done" }));
      }
    } catch (err) {
      console.error(err);
      setActionState((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  if (loading) return <p className="text-sm text-slate-600">Loading viewings...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (viewings.length === 0) return <p className="text-sm text-slate-600">No viewing requests yet.</p>;

  return (
    <div className="space-y-4">
      {viewings.map((req) => (
        <div key={req.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {req.properties?.title || "Home"} • {req.properties?.city}
              </p>
              <p className="text-xs text-slate-500">
                Preferred: {formatTimes(req.preferred_times || [], req.properties?.timezone)}
              </p>
            </div>
            <ViewingStatusBadge status={req.status} />
          </div>

          {req.message && <p className="mt-2 text-sm text-slate-700">Tenant note: {req.message}</p>}
          {req.proposed_times?.length ? (
            <p className="text-sm text-slate-700">
              Proposed: {formatTimes(req.proposed_times, req.properties?.timezone)}
            </p>
          ) : null}
          {req.approved_time && (
            <p className="text-sm text-slate-700">
              Approved: {formatTimes([req.approved_time], req.properties?.timezone)}
            </p>
          )}

          <div className="mt-3 space-y-2">
            <Input
              placeholder="Host message (optional)"
              value={hostMessage[req.id] || ""}
              onChange={(e) => setHostMessage((prev) => ({ ...prev, [req.id]: e.target.value }))}
            />
            <Input
              placeholder="Approved time (ISO) or proposed times, comma separated"
              value={proposedTimes[req.id] || ""}
              onChange={(e) => setProposedTimes((prev) => ({ ...prev, [req.id]: e.target.value }))}
            />
            <Input
              placeholder="Decline reason (e.g., schedule_conflict)"
              value={declineReason[req.id] || ""}
              onChange={(e) => setDeclineReason((prev) => ({ ...prev, [req.id]: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleRespond(req.id, "approve")} disabled={actionState[req.id] === "saving"}>
                Confirm this time
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleRespond(req.id, "propose")} disabled={actionState[req.id] === "saving"}>
                Suggest new times
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleRespond(req.id, "decline")} disabled={actionState[req.id] === "saving"}>
                Decline request
              </Button>
              {actionState[req.id] === "error" && (
                <span className="text-sm text-rose-600">Save failed</span>
              )}
              {actionState[req.id] === "done" && (
                <span className="text-sm text-emerald-700">Saved</span>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Times are shown in the property’s local time zone.
          </p>
        </div>
      ))}
    </div>
  );
}
