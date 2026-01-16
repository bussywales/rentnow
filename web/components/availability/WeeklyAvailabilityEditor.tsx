"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type Window = { start: string; end: string };
type DayRule = { dayOfWeek: number; windows: Window[] };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesToTime(mins: number) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function WeeklyAvailabilityEditor(props: {
  propertyId: string;
  initialRules: { day_of_week: number; start_minute: number; end_minute: number }[];
  onSaved?: () => void;
}) {
  const grouped: DayRule[] = DAY_LABELS.map((_, idx) => ({
    dayOfWeek: idx,
    windows: props.initialRules
      .filter((r) => r.day_of_week === idx)
      .map((r) => ({ start: minutesToTime(r.start_minute), end: minutesToTime(r.end_minute) })),
  }));
  const [rules, setRules] = useState<DayRule[]>(grouped);
  const [slotLength, setSlotLength] = useState<30 | 60>(30);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const seedDefault = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/availability/seed-default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: props.propertyId }),
      });
      if (!res.ok) {
        setMessage("Could not seed default schedule.");
      } else {
        setMessage("Default schedule created.");
        props.onSaved?.();
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not seed default schedule.");
    } finally {
      setSeeding(false);
    }
  };

  const updateWindow = (day: number, index: number, field: "start" | "end", value: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day
          ? {
              ...r,
              windows: r.windows.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
            }
          : r
      )
    );
  };

  const addWindow = (day: number) => {
    setRules((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day && r.windows.length < 3
          ? { ...r, windows: [...r.windows, { start: "09:00", end: "17:00" }] }
          : r
      )
    );
  };

  const removeWindow = (day: number, index: number) => {
    setRules((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day ? { ...r, windows: r.windows.filter((_, i) => i !== index) } : r
      )
    );
  };

  const toggleDay = (day: number) => {
    setRules((prev) =>
      prev.map((r) => (r.dayOfWeek === day ? { ...r, windows: r.windows.length ? [] : [{ start: "09:00", end: "17:00" }] } : r))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/availability/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: props.propertyId,
          slotLengthMinutes: slotLength,
          rules: rules.map((r) => ({ dayOfWeek: r.dayOfWeek, windows: r.windows })),
        }),
      });
      if (!res.ok) {
        setMessage("Could not save availability.");
      } else {
        setMessage("Availability saved.");
        props.onSaved?.();
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not save availability.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="availability-page">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Weekly schedule</h2>
          <p className="text-sm text-slate-600">Toggle days and set up to 3 windows between 06:00 and 22:00.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={seedDefault} data-testid="seed-default" disabled={seeding}>
            {seeding ? "Seeding..." : "Create default schedule"}
          </Button>
          <label className="text-sm font-semibold text-slate-700">Slot length</label>
          <Select
            value={String(slotLength)}
            onChange={(e) => setSlotLength(Number(e.target.value) as 30 | 60)}
            data-testid="slot-length"
          >
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {rules.map((day) => (
          <div key={day.dayOfWeek} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-900">{DAY_LABELS[day.dayOfWeek]}</div>
              <Button size="sm" variant="ghost" onClick={() => toggleDay(day.dayOfWeek)}>
                {day.windows.length ? "Mark unavailable" : "Mark available"}
              </Button>
            </div>
            {day.windows.length > 0 && (
              <div className="mt-2 space-y-2">
                {day.windows.map((win, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={win.start}
                      onChange={(e) => updateWindow(day.dayOfWeek, idx, "start", e.target.value)}
                    />
                    <span className="text-slate-500">to</span>
                    <Input
                      type="time"
                      value={win.end}
                      onChange={(e) => updateWindow(day.dayOfWeek, idx, "end", e.target.value)}
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeWindow(day.dayOfWeek, idx)}>
                      Remove
                    </Button>
                  </div>
                ))}
                {day.windows.length < 3 && (
                  <Button size="sm" variant="secondary" onClick={() => addWindow(day.dayOfWeek)}>
                    Add window
                  </Button>
                )}
              </div>
            )}
            {!day.windows.length && (
              <p className="mt-1 text-sm text-slate-500">Not available this day.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} data-testid="save-rules">
          {saving ? "Saving..." : "Save availability"}
        </Button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  );
}
