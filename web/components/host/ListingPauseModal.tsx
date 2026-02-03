"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const PAUSE_OPTIONS = [
  {
    value: "occupied",
    label: "Tenant moved in",
    helper: "Pause the listing while it is occupied.",
  },
  {
    value: "owner_hold",
    label: "Owner hold",
    helper: "Hide the listing temporarily while you decide.",
  },
  {
    value: "other",
    label: "Other",
    helper: "Add a short note for your records.",
  },
] as const;

type PauseOption = (typeof PAUSE_OPTIONS)[number]["value"];

type Props = {
  open: boolean;
  listingTitle?: string | null;
  onClose: () => void;
  onConfirm: (payload: { status: "paused_owner" | "paused_occupied"; paused_reason: string }) => void;
  submitting?: boolean;
  error?: string | null;
};

export function ListingPauseModal(props: Props) {
  if (!props.open) return null;
  return <ListingPauseModalInner {...props} />;
}

function ListingPauseModalInner({
  listingTitle,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [reason, setReason] = useState<PauseOption>("occupied");
  const [customReason, setCustomReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const isOther = reason === "other";
  const status = reason === "occupied" ? "paused_occupied" : "paused_owner";
  const resolvedReason = isOther ? customReason.trim() : reason === "owner_hold" ? "owner_hold" : "occupied";
  const displayError = localError || error;

  const handleConfirm = () => {
    setLocalError(null);
    if (isOther && !customReason.trim()) {
      setLocalError("Please add a short reason.");
      return;
    }
    onConfirm({ status, paused_reason: resolvedReason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4" role="dialog" aria-modal="true" aria-labelledby="pause-listing-title" data-testid="pause-listing-modal">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p id="pause-listing-title" className="text-sm font-semibold text-slate-900">
              Pause listing
            </p>
            <p className="text-xs text-slate-600">
              {listingTitle ? `"${listingTitle}" will be hidden from search.` : "This listing will be hidden from search."}
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close pause dialog"
          >
            x
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          {PAUSE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2 text-sm ${
                reason === option.value ? "border-slate-400 bg-slate-50" : "border-slate-200"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <input
                  type="radio"
                  name="pause-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                />
                {option.label}
              </span>
              <span className="text-xs text-slate-600">{option.helper}</span>
            </label>
          ))}
          {isOther && (
            <div>
              <label className="text-xs font-semibold text-slate-700" htmlFor="pause-custom-reason">
                Reason (required)
              </label>
              <textarea
                id="pause-custom-reason"
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                placeholder="Add a short note..."
                value={customReason}
                onChange={(event) => setCustomReason(event.target.value)}
                data-testid="pause-listing-custom-reason"
              />
            </div>
          )}
          {displayError && <p className="text-xs text-rose-600">{displayError}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={submitting} data-testid="pause-listing-confirm">
            {submitting ? "Pausing..." : "Pause listing"}
          </Button>
        </div>
      </div>
    </div>
  );
}
