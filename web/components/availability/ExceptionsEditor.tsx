"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type Exception = {
  local_date: string;
  exception_type: "blackout" | "add_window";
  start_minute?: number | null;
  end_minute?: number | null;
};

type Window = { start: string; end: string };

function minutesToTime(mins: number | null | undefined) {
  if (mins === null || mins === undefined) return "";
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function ExceptionsEditor(props: {
  propertyId: string;
  initial: Exception[];
  onChanged?: () => void;
}) {
  const [date, setDate] = useState("");
  const [type, setType] = useState<"blackout" | "add_window">("blackout");
  const [windows, setWindows] = useState<Window[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Exception[]>(props.initial);

  const addWindow = () => {
    if (windows.length >= 3) return;
    setWindows((prev) => [...prev, { start: "09:00", end: "12:00" }]);
  };

  const updateWindow = (idx: number, field: "start" | "end", value: string) => {
    setWindows((prev) => prev.map((w, i) => (i === idx ? { ...w, [field]: value } : w)));
  };

  const removeWindow = (idx: number) => setWindows((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/availability/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: props.propertyId,
          date,
          type,
          windows: type === "add_window" || windows.length ? windows : undefined,
        }),
      });
      if (!res.ok) {
        setError("Could not save exception.");
      } else {
        setItems((prev) => [
          ...prev.filter((ex) => !(ex.local_date === date && ex.exception_type === type)),
          ...windows.length
            ? windows.map((w) => ({
                local_date: date,
                exception_type: type,
                start_minute: timeToMinutes(w.start),
                end_minute: timeToMinutes(w.end),
              }))
            : [
                {
                  local_date: date,
                  exception_type: type,
                  start_minute: null,
                  end_minute: null,
                },
              ],
        ]);
        props.onChanged?.();
      }
    } catch (err) {
      console.error(err);
      setError("Could not save exception.");
    } finally {
      setSaving(false);
    }
  };

  const deleteException = async (ex: Exception) => {
    await fetch(
      `/api/availability/exceptions?propertyId=${props.propertyId}&date=${ex.local_date}&type=${ex.exception_type}`,
      { method: "DELETE" }
    );
    setItems((prev) =>
      prev.filter(
        (item) =>
          !(
            item.local_date === ex.local_date &&
            item.exception_type === ex.exception_type &&
            item.start_minute === ex.start_minute &&
            item.end_minute === ex.end_minute
          )
      )
    );
    props.onChanged?.();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Exceptions</h2>
        <Button size="sm" variant="secondary" onClick={addWindow} data-testid="exception-add">
          Add window
        </Button>
      </div>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-700">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="blackout">Unavailable</option>
              <option value="add_window">Extra availability</option>
            </Select>
          </div>
        </div>
        {windows.length > 0 && (
          <div className="space-y-2">
            {windows.map((w, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input type="time" value={w.start} onChange={(e) => updateWindow(idx, "start", e.target.value)} />
                <span className="text-slate-500">to</span>
                <Input type="time" value={w.end} onChange={(e) => updateWindow(idx, "end", e.target.value)} />
                <Button size="sm" variant="ghost" onClick={() => removeWindow(idx)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Save exception"}
        </Button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Upcoming exceptions</h3>
        {items.length === 0 && <p className="text-sm text-slate-600">None yet.</p>}
        {items.map((ex, idx) => (
          <div key={`${ex.local_date}-${ex.exception_type}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <p className="font-semibold text-slate-900">
                {ex.local_date} • {ex.exception_type === "blackout" ? "Unavailable" : "Extra availability"}
              </p>
              {ex.start_minute !== null && ex.end_minute !== null && (
                <p className="text-sm text-slate-600">
                  {minutesToTime(ex.start_minute)} – {minutesToTime(ex.end_minute)}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteException(ex)}
              data-testid="exception-delete"
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
