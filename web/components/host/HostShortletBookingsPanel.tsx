"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  parseHostBookingInboxFilterParam,
  parseHostBookingQueryParam,
  resolveHostBookingInboxFilter,
  resolveRespondByIso,
  rowMatchesHostBookingInboxFilter,
  sortHostBookingInboxRows,
  type HostBookingInboxFilter,
} from "@/lib/shortlet/host-bookings-inbox";
import {
  formatTimeRemaining,
  getSlaTier,
  groupAwaitingBookings,
  type HostInboxSlaTier,
} from "@/lib/shortlet/host-inbox-triage";
import type {
  HostShortletBookingSummary,
  HostShortletSettingSummary,
} from "@/lib/shortlet/shortlet.server";

type BookingAction = "approve" | "decline";
type BookingNote = {
  id: string;
  role: "tenant" | "host";
  topic: "check_in" | "question" | "arrival_time" | "other";
  message: string;
  created_at: string;
};

type BookingCoordination = {
  checkinStatus: "sent" | "not_sent" | "unavailable";
  canSendCheckin: boolean;
  sentAt: string | null;
};

function formatMoney(currency: string, amountMinor: number): string {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNoteTopic(topic: BookingNote["topic"]) {
  if (topic === "check_in") return "Check-in";
  if (topic === "arrival_time") return "Arrival time";
  if (topic === "question") return "Question";
  return "Other";
}

function statusTone(status: HostShortletBookingSummary["status"]) {
  if (status === "confirmed" || status === "completed") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
  if (status === "pending") return "text-sky-700 bg-sky-50 border-sky-200";
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "text-rose-700 bg-rose-50 border-rose-200";
  }
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function slaTone(tier: HostInboxSlaTier) {
  if (tier === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tier === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tier === "expired") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function maskGuestLabel(row: HostShortletBookingSummary): string {
  const raw = (row.guest_name || row.guest_user_id || "guest").trim();
  if (!raw) return "Guest";
  if (raw.includes("@")) {
    const [local, domain] = raw.split("@");
    const localSafe = local.length > 1 ? `${local[0]}***` : "***";
    return `${localSafe}@${domain || "***"}`;
  }
  if (raw.length <= 2) return `${raw[0] || "G"}*`;
  return `${raw.slice(0, 2)}***`;
}

function resolveRespondActionState(input: {
  status: HostShortletBookingSummary["status"];
  bookingMode: "request" | "instant";
}) {
  if (input.status !== "pending") {
    return {
      canRespond: false,
      reason: "Only pending requests can be approved or declined.",
    };
  }
  if (input.bookingMode !== "request") {
    return {
      canRespond: false,
      reason: "Instant bookings are auto-confirmed and cannot be manually approved.",
    };
  }
  return {
    canRespond: true,
    reason: null,
  };
}

export function HostShortletBookingsPanel(props: {
  initialRows: HostShortletBookingSummary[];
  settingsRows?: HostShortletSettingSummary[];
  focusBookingId?: string | null;
}) {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<HostShortletBookingSummary[]>(props.initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<HostBookingInboxFilter>("awaiting_approval");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [highlightBookingId, setHighlightBookingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [showBulkDeclineConfirm, setShowBulkDeclineConfirm] = useState(false);
  const [laterExpanded, setLaterExpanded] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sendingCheckinId, setSendingCheckinId] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<BookingNote[]>([]);
  const [selectedCoordination, setSelectedCoordination] = useState<BookingCoordination | null>(null);

  useEffect(() => {
    setRows(props.initialRows);
  }, [props.initialRows]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const targetId = parseHostBookingQueryParam(props.focusBookingId);
    if (!targetId) return;

    const target = rows.find((row) => row.id.toLowerCase() === targetId);
    if (!target) {
      setNotice("The linked booking was not found. It may have been archived.");
      return;
    }

    setFilter(resolveHostBookingInboxFilter(target));
    setSelectedBookingId(target.id);
    setHighlightBookingId(target.id);
    const targetTier = getSlaTier(resolveRespondByIso(target), nowMs);
    if (resolveHostBookingInboxFilter(target) === "awaiting_approval" && targetTier === "ok") {
      setLaterExpanded(true);
    }

    const clearTimer = window.setTimeout(() => {
      setHighlightBookingId((current) => (current === target.id ? null : current));
    }, 4_500);

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const rowElement = document.getElementById(`host-booking-row-${target.id}`);
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 60);
    });

    return () => window.clearTimeout(clearTimer);
  }, [nowMs, props.focusBookingId, rows]);

  useEffect(() => {
    if (parseHostBookingQueryParam(props.focusBookingId)) return;
    const requestedFilter = parseHostBookingInboxFilterParam(searchParams?.get("view"));
    if (!requestedFilter) return;
    setFilter(requestedFilter);
  }, [props.focusBookingId, searchParams]);

  useEffect(() => {
    if (!selectedBookingId) {
      setSelectedNotes([]);
      setNotesError(null);
      setNotesLoading(false);
      setSelectedCoordination(null);
      return;
    }

    let active = true;
    setNotesLoading(true);
    setNotesError(null);

    void fetch(`/api/shortlet/bookings/${selectedBookingId}/note`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { notes?: BookingNote[]; error?: string; coordination?: BookingCoordination }
          | null;
        if (!active) return;
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load guest notes");
        }
        setSelectedNotes(Array.isArray(payload?.notes) ? payload.notes : []);
        setSelectedCoordination(payload?.coordination ?? null);
      })
      .catch((loadError) => {
        if (!active) return;
        setNotesError(loadError instanceof Error ? loadError.message : "Unable to load guest notes");
        setSelectedCoordination(null);
      })
      .finally(() => {
        if (active) setNotesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedBookingId]);

  useEffect(() => {
    setSelectedIds([]);
    setBulkProgress(null);
  }, [filter]);

  const bookingModeByProperty = useMemo(() => {
    return new Map((props.settingsRows || []).map((row) => [row.property_id, row.booking_mode]));
  }, [props.settingsRows]);
  const hasCheckinByProperty = useMemo(() => {
    return new Map((props.settingsRows || []).map((row) => [row.property_id, !!row.has_checkin_details]));
  }, [props.settingsRows]);

  const filteredRows = useMemo(
    () =>
      sortHostBookingInboxRows(
        rows.filter((row) => rowMatchesHostBookingInboxFilter(row, filter)),
        filter
      ),
    [filter, rows]
  );

  useEffect(() => {
    const visible = new Set(filteredRows.map((row) => row.id));
    setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredRows]);

  const awaitingGroups = useMemo(
    () =>
      filter === "awaiting_approval"
        ? groupAwaitingBookings(filteredRows, nowMs)
        : { urgent: [] as HostShortletBookingSummary[], later: [] as HostShortletBookingSummary[] },
    [filter, filteredRows, nowMs]
  );

  useEffect(() => {
    if (filter !== "awaiting_approval") return;
    if (!awaitingGroups.urgent.length && !awaitingGroups.later.length) return;
    const defaultExpanded = awaitingGroups.urgent.length === 0;
    setLaterExpanded((prev) => (prev ? prev : defaultExpanded));
  }, [awaitingGroups.later.length, awaitingGroups.urgent.length, filter]);

  const rowSections = useMemo(() => {
    if (filter !== "awaiting_approval") {
      return [{ key: "all", label: null, rows: filteredRows, collapsible: false, count: filteredRows.length }];
    }
    const sections: Array<{
      key: string;
      label: string | null;
      rows: HostShortletBookingSummary[];
      collapsible: boolean;
      count: number;
    }> = [];
    if (awaitingGroups.urgent.length) {
      sections.push({
        key: "urgent",
        label: "Urgent",
        rows: awaitingGroups.urgent,
        collapsible: false,
        count: awaitingGroups.urgent.length,
      });
    }
    if (awaitingGroups.later.length) {
      sections.push({
        key: "later",
        label: "Later",
        rows: laterExpanded ? awaitingGroups.later : [],
        collapsible: true,
        count: awaitingGroups.later.length,
      });
    }
    return sections;
  }, [awaitingGroups.later, awaitingGroups.urgent, filter, filteredRows, laterExpanded]);

  const counts = useMemo(() => {
    return {
      awaiting_approval: rows.filter((row) => resolveHostBookingInboxFilter(row) === "awaiting_approval").length,
      upcoming: rows.filter((row) => resolveHostBookingInboxFilter(row) === "upcoming").length,
      past: rows.filter((row) => resolveHostBookingInboxFilter(row) === "past").length,
      closed: rows.filter((row) => resolveHostBookingInboxFilter(row) === "closed").length,
    } as Record<HostBookingInboxFilter, number>;
  }, [rows]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedBookingId) || null,
    [rows, selectedBookingId]
  );

  async function executeDecision(
    row: HostShortletBookingSummary,
    action: BookingAction,
    options?: { reason?: string; silentNotice?: boolean }
  ) {
    const bookingMode = bookingModeByProperty.get(row.property_id) || "request";
    const actionState = resolveRespondActionState({ status: row.status, bookingMode });
    if (!actionState.canRespond) {
      throw new Error(actionState.reason || "Booking cannot be updated");
    }

    const endpoint = action === "approve" ? "approve" : "decline";
    const response = await fetch(`/api/shortlet/bookings/${row.id}/${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options?.reason ? { reason: options.reason } : {}),
    });
    const payload = (await response.json().catch(() => null)) as
      | { booking?: { status?: HostShortletBookingSummary["status"] }; error?: string }
      | null;
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to update booking");
    }
    const fallbackStatus = action === "approve" ? "confirmed" : "declined";
    const nextStatus = payload?.booking?.status ?? fallbackStatus;
    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? {
              ...item,
              status: nextStatus,
              respond_by: null,
              expires_at: null,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );
    if (!options?.silentNotice) {
      setNotice(action === "approve" ? "Booking approved." : "Booking declined.");
    }
  }

  async function decide(row: HostShortletBookingSummary, action: BookingAction) {
    if (!row.id || busyId || bulkBusy) return;

    setBusyId(row.id);
    setError(null);
    setNotice(null);

    try {
      const reason =
        action === "decline"
          ? window.prompt("Reason for decline (optional)", "Dates not available")?.trim() || undefined
          : undefined;
      await executeDecision(row, action, { reason });
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Unable to update booking");
    } finally {
      setBusyId(null);
    }
  }

  async function sendCheckinDetailsNow(row: HostShortletBookingSummary) {
    if (!row.id || sendingCheckinId || busyId || bulkBusy) return;
    setSendingCheckinId(row.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/shortlet/bookings/${row.id}/send-checkin`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; alreadySent?: boolean; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send check-in details");
      }
      setSelectedCoordination((current) => ({
        checkinStatus: "sent",
        canSendCheckin: false,
        sentAt: current?.sentAt ?? new Date().toISOString(),
      }));
      setNotice(payload?.alreadySent ? "Check-in details were already shared." : "Check-in details shared.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send check-in details");
    } finally {
      setSendingCheckinId(null);
    }
  }

  async function runBulkAction(action: BookingAction) {
    if (bulkBusy || busyId) return;
    const selectedRows = filteredRows.filter((row) => selectedIds.includes(row.id));
    if (!selectedRows.length) return;

    setBulkBusy(true);
    setBulkProgress(`0/${selectedRows.length} completed`);
    setError(null);
    setNotice(null);

    const completedIds: string[] = [];
    for (let index = 0; index < selectedRows.length; index += 1) {
      const row = selectedRows[index];
      try {
        await executeDecision(row, action, {
          reason: action === "decline" ? "Declined by host (bulk action)." : undefined,
          silentNotice: true,
        });
        completedIds.push(row.id);
        setBulkProgress(`${index + 1}/${selectedRows.length} completed`);
      } catch (bulkError) {
        const reason = bulkError instanceof Error ? bulkError.message : "Unable to update booking";
        setError(
          `Bulk ${action} stopped at ${index + 1}/${selectedRows.length} for ${
            row.property_title || row.id
          }: ${reason}`
        );
        break;
      }
    }

    setSelectedIds((prev) => prev.filter((id) => !completedIds.includes(id)));
    if (completedIds.length === selectedRows.length) {
      setNotice(
        action === "approve"
          ? `Bulk approve completed (${completedIds.length}).`
          : `Bulk decline completed (${completedIds.length}).`
      );
    }
    setBulkBusy(false);
    setBulkProgress(null);
  }

  const filters: Array<{ key: HostBookingInboxFilter; label: string }> = [
    { key: "awaiting_approval", label: "Awaiting approval" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "closed", label: "Closed" },
  ];

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((rowId) => rowId !== id);
    });
  }

  function renderSlaBadge(row: HostShortletBookingSummary) {
    if (filter !== "awaiting_approval") return null;
    const respondByIso = resolveRespondByIso(row);
    const tier = getSlaTier(respondByIso, nowMs);
    return (
      <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${slaTone(tier)}`}>
        {formatTimeRemaining(respondByIso, nowMs)}
      </span>
    );
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="host-bookings-inbox">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Host shortlets</p>
          <h3 className="text-lg font-semibold text-slate-900">Bookings inbox</h3>
          <p className="text-sm text-slate-600">
            Review requests, respond in under 12 hours, and track upcoming and closed stays.
          </p>
        </div>
        <Link
          href="/host/shortlets/blocks"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Manage blocks
        </Link>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === item.key
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {item.label} ({counts[item.key]})
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">Response SLA for request bookings: 12 hours.</p>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}

      {rowSections.some((section) => section.rows.length > 0 || section.count > 0) ? (
        <>
          {filter === "awaiting_approval" && selectedIds.length ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">{selectedIds.length} selected</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void runBulkAction("approve")}
                    disabled={bulkBusy || busyId !== null}
                  >
                    {bulkBusy ? "Processing..." : "Bulk approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowBulkDeclineConfirm(true)}
                    disabled={bulkBusy || busyId !== null}
                  >
                    Bulk decline
                  </Button>
                </div>
              </div>
              {bulkProgress ? <p className="mt-2 text-xs text-slate-500">{bulkProgress}</p> : null}
            </div>
          ) : null}

          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2">{filter === "awaiting_approval" ? "Pick" : ""}</th>
                  <th className="px-3 py-2">Listing</th>
                  <th className="px-3 py-2">Dates</th>
                  <th className="px-3 py-2">Nights</th>
                  <th className="px-3 py-2">Guest</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Respond by</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rowSections.map((section) => (
                  <Fragment key={section.key}>
                    {section.label ? (
                      <tr key={`${section.key}-header`} className="bg-slate-50/80">
                        <td colSpan={10} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            <span>
                              {section.label} ({section.count})
                            </span>
                            {section.collapsible ? (
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
                                onClick={() => setLaterExpanded((prev) => !prev)}
                              >
                                {laterExpanded ? "Collapse" : "Expand"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {section.rows.map((row) => {
                      const bookingMode = bookingModeByProperty.get(row.property_id) || "request";
                      const actionState = resolveRespondActionState({
                        status: row.status,
                        bookingMode,
                      });
                      const respondByIso = resolveRespondByIso(row);
                      const rowHighlighted = highlightBookingId === row.id;
                      const isSelected = selectedIds.includes(row.id);
                      return (
                        <tr
                          key={row.id}
                          id={`host-booking-row-${row.id}`}
                          className={rowHighlighted ? "bg-sky-50/70" : undefined}
                          data-testid="host-booking-row"
                          data-respond-by={respondByIso || ""}
                        >
                          <td className="px-3 py-2 align-top">
                            {filter === "awaiting_approval" ? (
                              <input
                                type="checkbox"
                                aria-label={`Select booking ${row.id}`}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
                                checked={isSelected}
                                disabled={bulkBusy || !actionState.canRespond}
                                onChange={(event) => toggleSelected(row.id, event.currentTarget.checked)}
                              />
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setSelectedBookingId(row.id)}
                              className="min-w-0 text-left"
                            >
                              <div className="truncate font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</div>
                              <div className="truncate text-xs text-slate-500">{row.city || "Unknown city"}</div>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {formatDate(row.check_in)} to {formatDate(row.check_out)}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{row.nights}</td>
                          <td className="px-3 py-2 text-slate-700">{maskGuestLabel(row)}</td>
                          <td className="px-3 py-2 text-slate-700">{formatMoney(row.currency, row.total_amount_minor)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(row.created_at)}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">{renderSlaBadge(row) || "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setSelectedBookingId(row.id)}
                                data-testid="host-booking-view"
                              >
                                View
                              </Button>
                              {actionState.canRespond ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => void decide(row, "approve")}
                                    disabled={busyId === row.id || bulkBusy}
                                  >
                                    {busyId === row.id ? "Updating..." : "Approve"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => void decide(row, "decline")}
                                    disabled={busyId === row.id || bulkBusy}
                                  >
                                    Decline
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-2 md:hidden">
            {rowSections.map((section) => (
              <div key={`mobile-${section.key}`} className="space-y-2">
                {section.label ? (
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {section.label} ({section.count})
                    </p>
                    {section.collapsible ? (
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
                        onClick={() => setLaterExpanded((prev) => !prev)}
                      >
                        {laterExpanded ? "Collapse" : "Expand"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                    {section.rows.map((row) => {
                  const bookingMode = bookingModeByProperty.get(row.property_id) || "request";
                  const actionState = resolveRespondActionState({
                    status: row.status,
                    bookingMode,
                  });
                  const respondByIso = resolveRespondByIso(row);
                  const rowHighlighted = highlightBookingId === row.id;
                  const isSelected = selectedIds.includes(row.id);

                  return (
                    <div
                      key={row.id}
                      id={`host-booking-row-${row.id}`}
                      className={`rounded-xl border p-3 ${
                        rowHighlighted ? "border-sky-300 bg-sky-50/70" : "border-slate-200"
                      }`}
                      data-testid="host-booking-row"
                      data-respond-by={respondByIso || ""}
                    >
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBookingId(row.id)}
                          className="min-w-0 text-left"
                        >
                          <p className="truncate font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</p>
                          <p className="text-xs text-slate-500">{row.city || "Unknown city"}</p>
                        </button>
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                          {row.status}
                        </span>
                      </div>
                      {filter === "awaiting_approval" ? (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {renderSlaBadge(row)}
                          <input
                            type="checkbox"
                            aria-label={`Select booking ${row.id}`}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600"
                            checked={isSelected}
                            disabled={bulkBusy || !actionState.canRespond}
                            onChange={(event) => toggleSelected(row.id, event.currentTarget.checked)}
                          />
                        </div>
                      ) : null}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <p>Dates: {formatDate(row.check_in)} to {formatDate(row.check_out)}</p>
                        <p>Nights: {row.nights}</p>
                        <p>Guest: {maskGuestLabel(row)}</p>
                        <p>Total: {formatMoney(row.currency, row.total_amount_minor)}</p>
                        <p>Created: {formatDateTime(row.created_at)}</p>
                        <p>Respond by: {renderSlaBadge(row) ? formatTimeRemaining(respondByIso, nowMs) : "—"}</p>
                      </div>
                      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedBookingId(row.id)}
                          data-testid="host-booking-view"
                        >
                          View details
                        </Button>
                        {actionState.canRespond ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => void decide(row, "approve")}
                              disabled={busyId === row.id || bulkBusy}
                            >
                              {busyId === row.id ? "Updating..." : "Approve"}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void decide(row, "decline")}
                              disabled={busyId === row.id || bulkBusy}
                            >
                              Decline
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
          No bookings in this view yet.
        </div>
      )}

      {showBulkDeclineConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm bulk decline"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <h4 className="text-base font-semibold text-slate-900">Decline {selectedIds.length} requests?</h4>
            <p className="mt-2 text-sm text-slate-600">
              This will sequentially decline selected pending requests and stop if any request fails.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowBulkDeclineConfirm(false)}
                disabled={bulkBusy}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowBulkDeclineConfirm(false);
                  void runBulkAction("decline");
                }}
                disabled={bulkBusy}
              >
                Confirm decline
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedRow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Booking details"
          data-testid="host-booking-drawer"
        >
          <div className="h-[86vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Booking details</p>
                <p className="truncate text-xs text-slate-500">{selectedRow.property_title || "Shortlet listing"}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                onClick={() => setSelectedBookingId(null)}
                aria-label="Close booking details"
              >
                x
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-4 py-4 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Guest</p>
                  <p className="font-medium text-slate-900">{maskGuestLabel(selectedRow)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Status</p>
                  <p>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(selectedRow.status)}`}>
                      {selectedRow.status}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Check-in</p>
                  <p className="font-medium text-slate-900">{formatDate(selectedRow.check_in)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Check-out</p>
                  <p className="font-medium text-slate-900">{formatDate(selectedRow.check_out)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Nights</p>
                  <p className="font-medium text-slate-900">{selectedRow.nights}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total</p>
                  <p className="font-medium text-slate-900">
                    {formatMoney(selectedRow.currency, selectedRow.total_amount_minor)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Created</p>
                  <p className="font-medium text-slate-900">{formatDateTime(selectedRow.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Respond by</p>
                  <p className="font-medium text-slate-900">
                    {selectedRow.status === "pending"
                      ? formatTimeRemaining(resolveRespondByIso(selectedRow), nowMs)
                      : "Not required"}
                  </p>
                </div>
              </div>

              {(() => {
                const bookingMode = bookingModeByProperty.get(selectedRow.property_id) || "request";
                const actionState = resolveRespondActionState({
                  status: selectedRow.status,
                  bookingMode,
                });
                const fallbackHasCheckin = Boolean(hasCheckinByProperty.get(selectedRow.property_id));
                const checkinStatus =
                  selectedCoordination?.checkinStatus ??
                  (fallbackHasCheckin ? "not_sent" : "unavailable");
                const canSendCheckin =
                  selectedCoordination?.canSendCheckin ??
                  (selectedRow.status === "confirmed" && fallbackHasCheckin);
                const shouldRenderSendCheckin =
                  selectedRow.status === "confirmed" && checkinStatus !== "unavailable";
                const checkinSentAt = selectedCoordination?.sentAt;
                return (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Host response window for request bookings is 12 hours.
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void decide(selectedRow, "approve")}
                        disabled={busyId === selectedRow.id || !actionState.canRespond}
                        title={actionState.reason ?? undefined}
                        data-testid="host-booking-approve"
                      >
                        {busyId === selectedRow.id ? "Updating..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void decide(selectedRow, "decline")}
                        disabled={busyId === selectedRow.id || !actionState.canRespond}
                        title={actionState.reason ?? undefined}
                        data-testid="host-booking-decline"
                      >
                        Decline
                      </Button>
                      <Link
                        href="/host/shortlets/blocks"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Manage availability
                      </Link>
                      {shouldRenderSendCheckin ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void sendCheckinDetailsNow(selectedRow)}
                          disabled={sendingCheckinId === selectedRow.id || checkinStatus === "sent" || !canSendCheckin}
                          data-testid="host-booking-send-checkin"
                        >
                          {sendingCheckinId === selectedRow.id
                            ? "Sending..."
                            : checkinStatus === "sent"
                              ? "Check-in details sent"
                              : "Send check-in details now"}
                        </Button>
                      ) : null}
                    </div>
                    {!actionState.canRespond && actionState.reason ? (
                      <p className="text-xs text-slate-500">{actionState.reason}</p>
                    ) : null}

                    <div
                      className="rounded-xl border border-slate-200 bg-white p-3"
                      data-testid="host-booking-checkin-status"
                    >
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Check-in details status</p>
                      <p className="mt-2 text-xs text-slate-700">
                        {checkinStatus === "sent"
                          ? "sent"
                          : checkinStatus === "not_sent"
                            ? "not sent"
                            : "not configured"}
                      </p>
                      {checkinSentAt ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Last shared: {formatDateTime(checkinSentAt)}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3" data-testid="host-booking-guest-notes">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Guest notes</p>
                      {notesLoading ? (
                        <p className="mt-2 text-xs text-slate-500">Loading notes...</p>
                      ) : notesError ? (
                        <p className="mt-2 text-xs text-rose-600">{notesError}</p>
                      ) : selectedNotes.length ? (
                        <ul className="mt-2 space-y-2">
                          {selectedNotes.map((note) => (
                            <li key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                                <span className="font-semibold uppercase tracking-[0.1em]">
                                  {formatNoteTopic(note.topic)}
                                </span>
                                <span>{formatDateTime(note.created_at)}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-700">{note.message}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No guest notes yet.</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
