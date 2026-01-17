"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
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
  const [proposedTimes] = useState<Record<string, string>>({});
  const [hostMessage] = useState<Record<string, string>>({});
  const [noShowPending, setNoShowPending] = useState<Record<string, boolean>>({});
  const [successState, setSuccessState] = useState<Record<string, string>>({});
  const [preferredSelection, setPreferredSelection] = useState<Record<string, string>>({});
  const [activePropose, setActivePropose] = useState<string | null>(null);
  const [proposeSlots, setProposeSlots] = useState<Record<string, string[]>>({});
  const [proposeLoading, setProposeLoading] = useState<Record<string, boolean>>({});
  const [proposeSelection, setProposeSelection] = useState<Record<string, Set<string>>>({});
  const [declineOpen, setDeclineOpen] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});
  const [declineMessage, setDeclineMessage] = useState<Record<string, string>>({});

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
      payload.approvedTime =
        preferredSelection[req.id] || req.preferred_times?.[0] || proposedTimes[req.id];
    } else if (action === "propose") {
      payload.proposedTimes = Array.from(proposeSelection[req.id] || []);
    } else if (action === "decline") {
      payload.declineReasonCode = declineReason[req.id] || "not_available";
      if (declineMessage[req.id]) {
        payload.hostMessage = declineMessage[req.id];
      }
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
            return {
              ...v,
              status: "proposed",
              proposed_times: (payload.proposedTimes as string[]) || [],
              decided_at: now,
            };
          })
        );
        setActivePropose(null);
        setDeclineOpen(null);
      }
    } catch (err) {
      console.error(err);
      setActionState((prev) => ({ ...prev, [req.id]: "error" }));
    }
  };

  const togglePreferred = (reqId: string, iso: string) => {
    setPreferredSelection((prev) => ({ ...prev, [reqId]: iso }));
  };

  const openPropose = async (req: Viewing) => {
    setActivePropose(req.id);
    if (proposeSlots[req.id]?.length) return;
    setProposeLoading((prev) => ({ ...prev, [req.id]: true }));
    try {
      const first = req.preferred_times?.[0];
      const date = first ? new Date(first).toISOString().slice(0, 10) : "";
      const res = await fetch(
        `/api/availability/slots?propertyId=${req.property_id}&date=${date}`
      );
      const json = await res.json();
      if (res.ok && Array.isArray(json.slots)) {
        setProposeSlots((prev) => ({ ...prev, [req.id]: json.slots }));
        setProposeSelection((prev) => ({ ...prev, [req.id]: new Set<string>() }));
      } else {
        setProposeSlots((prev) => ({ ...prev, [req.id]: req.preferred_times || [] }));
      }
    } catch (err) {
      console.debug("availability slots fetch error", err);
      setProposeSlots((prev) => ({ ...prev, [req.id]: req.preferred_times || [] }));
    } finally {
      setProposeLoading((prev) => ({ ...prev, [req.id]: false }));
    }
  };

  const toggleProposeSlot = (reqId: string, iso: string) => {
    setProposeSelection((prev) => {
      const current = new Set(prev[reqId] || []);
      if (current.has(iso)) {
        current.delete(iso);
      } else if (current.size < 3) {
        current.add(iso);
      }
      return { ...prev, [reqId]: current };
    });
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
            {!req.approved_time && (req.preferred_times || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(req.preferred_times || []).map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    data-testid="preferred-time-option"
                    onClick={() => togglePreferred(req.id, iso)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      preferredSelection[req.id] === iso
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    )}
                  >
                    {formatTimes([iso], req.properties?.timezone)}
                  </button>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-700">
              Viewing reliability: {reliabilityLabel} {reliabilityText}
            </p>

            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  data-testid="confirm-btn"
                  onClick={() => handleRespond(req, "approve")}
                  disabled={actionState[req.id] === "saving" || !((preferredSelection[req.id] || req.preferred_times?.[0]))}
                >
                  Confirm this time
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  data-testid="suggest-btn"
                  onClick={() => openPropose(req)}
                  disabled={actionState[req.id] === "saving"}
                >
                  Suggest new times
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="decline-btn"
                  onClick={() => setDeclineOpen(req.id)}
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
              {activePropose === req.id && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Suggest new times</p>
                  <p className="text-xs text-slate-600">Select up to 3 slots. Times shown in the property’s timezone.</p>
                  {proposeLoading[req.id] ? (
                    <p className="text-xs text-slate-600">Loading slots…</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(proposeSlots[req.id] || []).map((iso) => (
                        <button
                          key={iso}
                          type="button"
                          data-testid="propose-slot-chip"
                          onClick={() => toggleProposeSlot(req.id, iso)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs",
                            proposeSelection[req.id]?.has(iso)
                              ? "border-sky-500 bg-sky-50 text-sky-700"
                              : "border-slate-200 bg-white text-slate-700"
                          )}
                        >
                          {formatTimes([iso], req.properties?.timezone)}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRespond(req, "propose")}
                      disabled={(proposeSelection[req.id]?.size || 0) === 0}
                    >
                      Send times
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setActivePropose(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {declineOpen === req.id && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Decline request</p>
                  <div className="mt-2 space-y-2">
                    <label className="text-xs text-slate-600">
                      Reason
                      <select
                        data-testid="decline-reason-select"
                        className="mt-1 w-full rounded-md border border-slate-200 p-2 text-sm"
                        value={declineReason[req.id] || "not_available"}
                        onChange={(e) =>
                          setDeclineReason((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                      >
                        <option value="not_available">Not available</option>
                        <option value="schedule_conflict">Schedule conflict</option>
                        <option value="maintenance">Maintenance or access issues</option>
                        <option value="already_booked">Time already booked</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="text-xs text-slate-600">
                      Message (optional)
                      <textarea
                        className="mt-1 w-full rounded-md border border-slate-200 p-2 text-sm"
                        rows={2}
                        value={declineMessage[req.id] || ""}
                        onChange={(e) =>
                          setDeclineMessage((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                      />
                    </label>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => handleRespond(req, "decline")}>
                        Send decline
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeclineOpen(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
