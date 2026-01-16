"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function SlotPreview({ propertyId }: { propertyId: string }) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ utc: string; local: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/availability/slots?propertyId=${propertyId}&date=${encodeURIComponent(date)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Could not load slots");
        setSlots([]);
      } else {
        setSlots(json.slots || []);
      }
    } catch (err) {
      console.error(err);
      setError("Could not load slots");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="preview-date"
        />
        <Button onClick={fetchSlots} disabled={!date}>
          Preview slots
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {slots && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="preview-slots">
          {slots.length === 0 && <p className="text-sm text-slate-600">No slots for this date.</p>}
          {slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <span key={slot.utc} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm">
                  {slot.local}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
