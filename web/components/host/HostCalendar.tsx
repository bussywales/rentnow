"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/Button";
import type { HostAgendaItem } from "@/lib/shortlet/host-agenda.server";
import {
  buildAgendaForDay,
  buildHostCalendarAvailability,
  type HostCalendarBlockRow,
  type HostCalendarBookingRow,
} from "@/lib/shortlet/host-calendar";
import { fromDateKey, toDateKey } from "@/lib/shortlet/availability";
import type { DateRange } from "react-day-picker";

type HostCalendarProperty = {
  id: string;
  title: string | null;
};

function addDays(dateKey: string, days: number) {
  const date = fromDateKey(dateKey);
  if (!date) return dateKey;
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function isPastDate(date: Date) {
  const today = new Date();
  const todayKey = toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  return toDateKey(date) < todayKey;
}

function formatAgendaHeading(dayIso: string | null) {
  if (!dayIso) return "Agenda";
  const parsed = fromDateKey(dayIso);
  if (!parsed) return "Agenda";
  return `Agenda — ${parsed.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}`;
}

export function HostCalendar(props: {
  properties: HostCalendarProperty[];
  initialBlocks: HostCalendarBlockRow[];
  initialBookings: HostCalendarBookingRow[];
  initialAgenda: {
    today: HostAgendaItem[];
    tomorrow: HostAgendaItem[];
    next7Days: HostAgendaItem[];
  };
  initialPropertyId?: string | null;
}) {
  const [blocks, setBlocks] = useState<HostCalendarBlockRow[]>(props.initialBlocks);
  const [propertyId, setPropertyId] = useState(
    props.initialPropertyId && props.properties.some((row) => row.id === props.initialPropertyId)
      ? props.initialPropertyId
      : props.properties[0]?.id || ""
  );
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [agendaTab, setAgendaTab] = useState<"today" | "tomorrow" | "next7Days">(() => {
    if (props.initialAgenda.today.length) return "today";
    if (props.initialAgenda.tomorrow.length) return "tomorrow";
    return "next7Days";
  });

  const propertyLabelById = useMemo(
    () => new Map(props.properties.map((row) => [row.id, row.title || row.id])),
    [props.properties]
  );

  const availability = useMemo(
    () =>
      buildHostCalendarAvailability({
        propertyId,
        blocks,
        bookings: props.initialBookings,
      }),
    [blocks, propertyId, props.initialBookings]
  );

  const propertyBlocks = useMemo(
    () => blocks.filter((row) => row.property_id === propertyId),
    [blocks, propertyId]
  );

  const agenda = useMemo(() => {
    if (!selectedDayIso) return null;
    return buildAgendaForDay({
      dayIso: selectedDayIso,
      bookings: props.initialBookings,
      blocks,
      propertyTitleById: propertyLabelById,
    });
  }, [blocks, propertyLabelById, props.initialBookings, selectedDayIso]);
  const agendaTabs = [
    { key: "today" as const, label: "Today", rows: props.initialAgenda.today },
    { key: "tomorrow" as const, label: "Tomorrow", rows: props.initialAgenda.tomorrow },
    { key: "next7Days" as const, label: "Next 7 days", rows: props.initialAgenda.next7Days },
  ];
  const activeAgendaRows = agendaTabs.find((row) => row.key === agendaTab)?.rows ?? [];

  async function onAddBlock() {
    if (busy) return;
    setError(null);
    setNotice(null);

    if (!propertyId) {
      setError("Select a listing first.");
      return;
    }
    if (!range?.from || !range?.to) {
      setError("Select a valid date range to block.");
      return;
    }

    const dateFrom = toDateKey(range.from);
    const dateToExclusive = addDays(toDateKey(range.to), 1);

    if (dateToExclusive <= dateFrom) {
      setError("Choose a valid range.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/shortlet/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          date_from: dateFrom,
          date_to: dateToExclusive,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            block?: {
              id: string;
              property_id: string;
              date_from: string;
              date_to: string;
              reason: string | null;
            };
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.block) {
        throw new Error(payload?.error || "Unable to block dates");
      }

      const newBlock: HostCalendarBlockRow = payload.block;
      setBlocks((prev) => [...prev, newBlock].sort((a, b) => a.date_from.localeCompare(b.date_from)));
      setRange(undefined);
      setNotice("Dates blocked.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to block dates");
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveBlock(blockId: string) {
    if (!blockId || removingId) return;
    setRemovingId(blockId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/shortlet/blocks/${blockId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to remove block");
      }
      setBlocks((prev) => prev.filter((row) => row.id !== blockId));
      setNotice("Block removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove block");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="host-calendar">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Host shortlets</p>
          <h2 className="text-lg font-semibold text-slate-900">Availability calendar</h2>
          <p className="text-sm text-slate-600">Booked dates are read-only. Select a range to add host blocks.</p>
        </div>
        <label className="text-xs text-slate-600">
          Listing
          <select
            className="mt-1 min-w-56 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            value={propertyId}
            onChange={(event) => {
              setPropertyId(event.target.value);
              setRange(undefined);
              setError(null);
              setNotice(null);
            }}
          >
            {props.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.title || property.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!props.properties.length ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          No shortlet listings available for calendar management yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-xl border border-slate-200">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(nextRange) => {
                setRange(nextRange);
                setError(null);
                setNotice(null);
              }}
              onDayClick={(day) => {
                setSelectedDayIso(toDateKey(day));
              }}
              disabled={(date) => {
                const key = toDateKey(date);
                return (
                  isPastDate(date) ||
                  availability.bookedDateSet.has(key) ||
                  availability.blockedDateSet.has(key)
                );
              }}
              modifiers={{
                booked: (date) => availability.bookedDateSet.has(toDateKey(date)),
                blocked: (date) => availability.blockedDateSet.has(toDateKey(date)),
              }}
              modifiersClassNames={{
                booked: "bg-rose-50 text-rose-600 line-through",
                blocked: "bg-amber-50 text-amber-700",
              }}
              numberOfMonths={1}
            />
            <div className="border-t border-slate-200 px-3 py-3 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-300" /> Booked</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-300" /> Blocked</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> Today</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void onAddBlock()} disabled={busy || !range?.from || !range?.to}>
                  {busy ? "Saving..." : "Block dates"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setRange(undefined)} disabled={busy || !range?.from}>
                  Clear
                </Button>
              </div>
              {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
              {notice ? <p className="mt-2 text-xs text-emerald-700">{notice}</p> : null}
            </div>
          </div>

          <div className="space-y-4">
            <aside className="rounded-xl border border-slate-200 bg-slate-50/60 p-3" data-testid="host-checkin-agenda">
              <h3 className="text-sm font-semibold text-slate-900">Check-in agenda</h3>
              <p className="mt-1 text-xs text-slate-500">Prioritize arrivals and approvals in the next few days.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {agendaTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAgendaTab(tab.key)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      agendaTab === tab.key
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {tab.label} ({tab.rows.length})
                  </button>
                ))}
              </div>
              {activeAgendaRows.length ? (
                <div className="mt-3 space-y-2">
                  {activeAgendaRows.map((item) => (
                    <div key={item.bookingId} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                      <p className="font-semibold text-slate-800">{item.title}</p>
                      <p className="text-slate-500">{item.city || "Unknown city"}</p>
                      <p className="mt-1 text-slate-600">
                        {item.checkIn} to {item.checkOut}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-semibold ${
                            item.status === "pending"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="text-slate-500">{item.guestLabel}</span>
                      </div>
                      <Link
                        href={`/host/bookings?booking=${item.bookingId}`}
                        className="mt-2 inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {item.status === "pending" ? "Review booking" : "View guest info"}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                  No check-ins in this window.
                </p>
              )}
            </aside>

            <aside className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <h3 className="text-sm font-semibold text-slate-900">Existing blocks</h3>
              <p className="mt-1 text-xs text-slate-500">
                {propertyLabelById.get(propertyId) || "Listing"}
              </p>
              {propertyBlocks.length ? (
                <div className="mt-3 space-y-2">
                  {propertyBlocks.map((row) => (
                    <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                      <p className="font-semibold text-slate-800">{row.date_from} to {row.date_to}</p>
                      <p className="text-slate-500">{row.reason || "No reason"}</p>
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-sky-700 underline underline-offset-2"
                        disabled={removingId === row.id}
                        onClick={() => void onRemoveBlock(row.id)}
                      >
                        {removingId === row.id ? "Removing..." : "Unblock"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No blocks for this listing.</p>
              )}
            </aside>
          </div>
        </div>
      )}

      {agenda ? (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-label="Day agenda"
          onClick={() => setSelectedDayIso(null)}
        >
          <div
            className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[430px] sm:max-h-none sm:rounded-none sm:rounded-l-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{formatAgendaHeading(agenda.dayIso)}</h3>
                <p className="text-xs text-slate-500">Arrivals, departures, in-progress stays, and blocks.</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                onClick={() => setSelectedDayIso(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Arrivals</p>
                {agenda.arrivals.length ? (
                  <div className="mt-2 space-y-2">
                    {agenda.arrivals.map((item) => (
                      <div key={`arrival-${item.bookingId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <p className="font-semibold text-slate-900">{item.propertyTitle}</p>
                        <p className="text-xs text-slate-600">{item.guestLabel} · {item.status}</p>
                        <Link
                          href={`/host/bookings?booking=${encodeURIComponent(item.bookingId)}`}
                          className="mt-1 inline-block text-xs font-semibold text-sky-700 underline underline-offset-2"
                        >
                          Open booking
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No arrivals.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Departures</p>
                {agenda.departures.length ? (
                  <div className="mt-2 space-y-2">
                    {agenda.departures.map((item) => (
                      <div key={`departure-${item.bookingId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <p className="font-semibold text-slate-900">{item.propertyTitle}</p>
                        <p className="text-xs text-slate-600">{item.guestLabel} · {item.status}</p>
                        <Link
                          href={`/host/bookings?booking=${encodeURIComponent(item.bookingId)}`}
                          className="mt-1 inline-block text-xs font-semibold text-sky-700 underline underline-offset-2"
                        >
                          Open booking
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No departures.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Stays in progress</p>
                {agenda.inProgress.length ? (
                  <div className="mt-2 space-y-2">
                    {agenda.inProgress.map((item) => (
                      <div key={`in-progress-${item.bookingId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <p className="font-semibold text-slate-900">{item.propertyTitle}</p>
                        <p className="text-xs text-slate-600">{item.guestLabel} · {item.status}</p>
                        <Link
                          href={`/host/bookings?booking=${encodeURIComponent(item.bookingId)}`}
                          className="mt-1 inline-block text-xs font-semibold text-sky-700 underline underline-offset-2"
                        >
                          Open booking
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No active stays.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Blocks</p>
                {agenda.blocks.length ? (
                  <div className="mt-2 space-y-2">
                    {agenda.blocks.map((item) => (
                      <div key={`block-${item.blockId}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                        <p className="font-semibold text-slate-900">{item.propertyTitle}</p>
                        <p className="text-xs text-slate-600">{item.reason || "Host block"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No blocks.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
