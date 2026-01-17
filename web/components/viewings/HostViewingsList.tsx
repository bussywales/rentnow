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
  no_show_reported_at?: string | null;
  proposed_times?: string[] | null;
  approved_time?: string | null;
  host_message?: string | null;
  decline_reason_code?: string | null;
  message?: string | null;
  created_at: string;
  tenantReliability?: { noShowCount90d: number; completedCount90d: number; label: string };
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
  const [noShowPending, setNoShowPending] = useState<Record<string, boolean>>({});
  const [successState, setSuccessState] = useState<Record<string, string>>({});

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

  const markNoShow = async (id: string, title?: string | null) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Only mark this if the tenant didn’t attend and didn’t notify you.")
    ) {
      return;
    }
    setNoShowPending((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/viewings/${id}/no-show`, { method: "POST" });
      if (res.ok) {
        setViewings((prev) =>
          prev.map((v) =>
            v.id === id
              ? {
                  ...v,
                  status: "no_show",
                  no_show_reported_at: new Date().toISOString(),
                }
              : v
          )
        );
      } else {
        console.warn("Unable to mark no-show", { id, title });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setNoShowPending((p) => ({ ...p, [id]: false }));
    }
  };

  const handleRespond = async (req: Viewing, action: "approve" | "propose" | "decline") => {
    const payload: Record<string, unknown> = {
      viewingRequestId: req.id,
      action,
      hostMessage: hostMessage[req.id] || undefined,
    };
    if (action === "approve") {
      payload.approvedTime = proposedTimes[req.id] || req.preferred_times?.[0];
    } else if (action === "propose") {
      payload.proposedTimes = (proposedTimes[req.id] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (action === "decline") {
      payload.declineReasonCode = declineReason[req.id] || "not_available";
    }
    setActionState((prev) => ({ ...prev, [req.id]: "saving" }));
    try {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[host-viewings] respond", { action, payload });
      }
      const res = await fetch("/api/viewings/respond", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setActionState((prev) => ({ ...prev, [req.id]: "error" }));
      } else {
        const now = new Date().toISOString();
        setActionState((prev) => ({ ...prev, [req.id]: "done" }));
        setSuccessState((prev) => ({
          ...prev,
          [req.id]:
            action === "approve"
              ? "Viewing confirmed"
              : action === "decline"
                ? "Request declined"
                : "Response sent",
        }));
        setViewings((prev) =>
          prev.map((v) => {
            if (v.id !== req.id) return v;
            if (action === "approve") {
              return {
                ...v,
                status: "approved",
                approved_time:
                  (payload.approvedTime as string) || v.preferred_times?.[0] || null,
                decided_at: now,
              };
            }
            if (action === "decline") {
              return {
                ...v,
                status: "declined",
                decline_reason_code: (payload.declineReasonCode as string) || "not_available",
                decided_at: now,
              };
            }
            return { ...v, status: "proposed", decided_at: now };
          })
        );
      }
    } catch (err) {
      console.error(err);
      setActionState((prev) => ({ ...prev, [req.id]: "error" }));
    }
  };

  if (loading) return <p className="text-sm text-slate-600">Loading viewings...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (viewings.length === 0) return <p className="text-sm text-slate-600">No viewing requests yet.</p>;

  return (
    <div className="space-y-4">
      {viewings.map((req) => {
        const badgeStatus = req.no_show_reported_at ? "no_show" : req.status;
        const reliabilityLabel = req.tenantReliability?.label || "Unknown";
        const noShowCount = req.tenantReliability?.noShowCount90d || 0;
        const reliabilityText =
          reliabilityLabel === "Mixed"
            ? `(${noShowCount} ${noShowCount === 1 ? "no-show" : "no-shows"} in last 90 days)`
            : reliabilityLabel === "Reliable"
              ? "(no no-shows in last 90 days)"
              : "(no recent viewing history)";

        return (
          <div
            key={req.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            data-testid="host-viewing-row"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900" data-testid="host-viewing-title">
                  {req.properties?.title || "Home"} • {req.properties?.city}
                </p>
                <p className="text-xs text-slate-500">
                  Preferred: {formatTimes(req.preferred_times || [], req.properties?.timezone)}
                </p>
              </div>
              <ViewingStatusBadge status={badgeStatus} />
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
            <p className="text-sm text-slate-700">
              Viewing reliability: {reliabilityLabel} {reliabilityText}
            </p>

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
                <Button
                  size="sm"
                  onClick={() => handleRespond(req, "approve")}
                  disabled={actionState[req.id] === "saving"}
                >
                  Confirm this time
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleRespond(req, "propose")}
                  disabled={actionState[req.id] === "saving"}
                >
                  Suggest new times
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRespond(req, "decline")}
                  disabled={actionState[req.id] === "saving"}
                >
                  Decline request
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="mark-no-show"
                  onClick={() => markNoShow(req.id, req.properties?.title)}
                  disabled={noShowPending[req.id] || !!req.no_show_reported_at}
                >
                  {req.no_show_reported_at ? "No-show recorded" : "Mark as no-show"}
                </Button>
                {actionState[req.id] === "error" && (
                  <span className="text-sm text-rose-600">Save failed</span>
                )}
                {actionState[req.id] === "done" && (
                  <span className="text-sm text-emerald-700">
                    {successState[req.id] || "Saved"}
                  </span>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Times are shown in the property’s local time zone.
            </p>
          </div>
        );
      })}
    </div>
  );
}
