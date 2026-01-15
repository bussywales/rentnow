"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type Props = {
  propertyId: string;
  timezone?: string | null;
  city?: string | null;
  disabled?: boolean;
};

type Slot = { iso: string; label: string };

const MAX_TIMES = 3;
const DEFAULT_MESSAGE =
  "I’d like to request a viewing of this property at the selected time(s). Please let me know what works for you.";
const DEFAULT_TIMEZONE = "Africa/Lagos";

function formatLocalDate(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()); // YYYY-MM-DD
}

function getOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );
  return (asUtc - date.getTime()) / 60000;
}

function zonedTimeToUTCISO(dateStr: string, hour: number, minute: number, timeZone: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(year, (month ?? 1) - 1, day ?? 1, hour, minute);
  const offsetMinutes = getOffsetMinutes(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMinutes * 60000).toISOString();
}

function formatSlotLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function generateSlots(dateStr: string, durationMinutes: number, timeZone: string): Slot[] {
  const slots: Slot[] = [];
  const startMinutes = 6 * 60;
  const endMinutes = 22 * 60;
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += durationMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const iso = zonedTimeToUTCISO(dateStr, hour, minute, timeZone);
    slots.push({
      iso,
      label: formatSlotLabel(iso, timeZone),
    });
  }
  return slots;
}

export function RequestViewingButton({ propertyId, timezone, city, disabled }: Props) {
  const timeZone = timezone || DEFAULT_TIMEZONE;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDate(timeZone));
  const [duration, setDuration] = useState<30 | 60>(60);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  useEffect(() => {
    // refresh date if timezone changes
    setSelectedDate(formatLocalDate(timeZone));
  }, [timeZone]);

  const slots = useMemo(
    () => generateSlots(selectedDate, duration, timeZone),
    [selectedDate, duration, timeZone]
  );

  const toggleSlot = (iso: string) => {
    setSelectedSlots((prev) => {
      if (prev.includes(iso)) {
        return prev.filter((item) => item !== iso);
      }
      if (prev.length >= MAX_TIMES) return prev;
      return [...prev, iso];
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (selectedSlots.length === 0 || selectedSlots.length > MAX_TIMES) {
      setError("Select 1 to 3 preferred slots.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/viewings/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          preferredTimes: selectedSlots,
          message: message?.trim() ? message.trim() : undefined,
        }),
      });
      if (!res.ok) {
        setError("We couldn't send your request. Please try again.");
      } else {
        setSuccess(true);
        setOpen(false);
      }
    } catch (err) {
      console.error("viewing request failed", err);
      setError("We couldn't send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          data-testid="request-viewing-button"
          onClick={() => {
            setOpen(true);
            if (!message) setMessage(DEFAULT_MESSAGE);
          }}
          disabled={disabled || success}
        >
          {success || disabled ? "Viewing requested" : "Request a viewing"}
        </Button>
        {success && (
          <Link href="/tenant/viewings" className="text-sm font-semibold text-sky-700 underline">
            View my requests
          </Link>
        )}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl outline outline-1 outline-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">Request a viewing</p>
                <p className="text-sm text-slate-600">
                  Pick up to 3 slots. We’ll notify the host with your preferred times.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-700">Date</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    data-testid="slot-date"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">Slot length</span>
                  <div className="flex gap-2">
                    {[30, 60].map((len) => (
                      <button
                        key={len}
                        type="button"
                        data-testid={`slot-duration-${len}`}
                        className={`rounded-full border px-3 py-1 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                          duration === len
                            ? "border-sky-600 bg-sky-50 text-sky-800"
                            : "border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                        onClick={() => setDuration(len as 30 | 60)}
                      >
                        {len}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    Select slots (selected {selectedSlots.length}/3)
                  </p>
                  <p className="text-xs text-slate-600">
                    Times shown in {city || "property"} time ({timeZone})
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" data-testid="slot-picker">
                  {slots.map((slot) => {
                    const isSelected = selectedSlots.includes(slot.iso);
                    return (
                      <button
                        key={slot.iso}
                        type="button"
                        data-testid="slot-option"
                        className={`rounded-full border px-3 py-1 text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                          isSelected
                            ? "border-sky-700 bg-sky-700 text-white focus:ring-sky-500"
                            : "border-slate-200 text-slate-700 hover:border-slate-300 focus:ring-slate-400"
                        }`}
                        onClick={() => toggleSlot(slot.iso)}
                        aria-pressed={isSelected}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Message (optional)
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                  className="mt-1"
                  rows={3}
                  maxLength={500}
                  placeholder="Share any preferences or context"
                />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              {process.env.NODE_ENV !== "production" && !timezone && (
                <p className="text-xs text-amber-700">
                  Warning: timezone missing; defaulting to Africa/Lagos.
                </p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                data-testid="submit-viewing-button"
                onClick={handleSubmit}
                disabled={submitting || selectedSlots.length === 0}
              >
                {submitting ? "Sending..." : "Send request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
