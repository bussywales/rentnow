"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type DurationPreset = "7" | "30" | "none";

type Props = {
  open: boolean;
  listingTitle?: string | null;
  submitting?: boolean;
  error?: string | null;
  defaultDurationDays?: 7 | 30 | null;
  defaultNote?: string | null;
  onClose: () => void;
  onSubmit: (payload: { durationDays: 7 | 30 | null; note: string | null }) => void;
};

const NOTE_LIMIT = 280;

function toPreset(durationDays: 7 | 30 | null | undefined): DurationPreset {
  if (durationDays === 7) return "7";
  if (durationDays === 30) return "30";
  return "none";
}

export function HostFeaturedRequestModal({
  open,
  listingTitle,
  submitting = false,
  error = null,
  defaultDurationDays = 7,
  defaultNote = null,
  onClose,
  onSubmit,
}: Props) {
  const [durationPreset, setDurationPreset] = useState<DurationPreset>(() =>
    toPreset(defaultDurationDays)
  );
  const [note, setNote] = useState(() => defaultNote ?? "");

  const noteRemaining = NOTE_LIMIT - note.length;
  const durationDays = useMemo<7 | 30 | null>(() => {
    if (durationPreset === "7") return 7;
    if (durationPreset === "30") return 30;
    return null;
  }, [durationPreset]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
      data-testid="host-featured-request-modal"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Request Featured</h3>
        <p className="mt-2 text-sm text-slate-700">
          Send a featured request for <span className="font-semibold">{listingTitle || "this listing"}</span>.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          We&apos;ll review it and schedule featured visibility if approved.
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Duration
          </legend>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "7", label: "7 days" },
              { key: "30", label: "30 days" },
              { key: "none", label: "No expiry" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  durationPreset === option.key
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setDurationPreset(option.key as DurationPreset)}
                disabled={submitting}
                data-testid={`host-featured-duration-${option.key}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="featured-request-note">
            Note (optional)
          </label>
          <textarea
            id="featured-request-note"
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, NOTE_LIMIT))}
            rows={3}
            maxLength={NOTE_LIMIT}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder="I’m promoting this property this month"
            data-testid="host-featured-note"
          />
          <p className="text-xs text-slate-500">{noteRemaining} characters left.</p>
        </div>

        {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSubmit({ durationDays, note: note.trim() ? note.trim() : null })}
            disabled={submitting}
            data-testid="host-featured-request-confirm"
          >
            {submitting ? "Sending…" : "Request featured"}
          </Button>
        </div>
      </div>
    </div>
  );
}
