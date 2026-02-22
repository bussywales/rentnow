"use client";

import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/Button";
import { buildHostCalendarAvailability, type HostCalendarBlockRow, type HostCalendarBookingRow } from "@/lib/shortlet/host-calendar";
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

export function HostCalendar(props: {
  properties: HostCalendarProperty[];
  initialBlocks: HostCalendarBlockRow[];
  initialBookings: HostCalendarBookingRow[];
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

      setBlocks((prev) => [...prev, payload.block].sort((a, b) => a.date_from.localeCompare(b.date_from)));
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
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-slate-200">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(nextRange) => {
                setRange(nextRange);
                setError(null);
                setNotice(null);
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
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> Available</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-300" /> Booked</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-300" /> Blocked</span>
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
      )}
    </section>
  );
}
