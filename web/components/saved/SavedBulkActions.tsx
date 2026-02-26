"use client";

import { useState } from "react";

type SavedBulkActionsProps = {
  totalCount: number;
  onClearAll: () => void;
};

export function SavedBulkActions({ totalCount, onClearAll }: SavedBulkActionsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      data-testid="saved-bulk-actions"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Saved items</p>
        <p className="text-sm text-slate-700">{totalCount} saved in this market</p>
      </div>
      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              data-testid="saved-clear-all-cancel"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              data-testid="saved-clear-all-confirm"
              onClick={() => {
                onClearAll();
                setConfirming(false);
              }}
            >
              Confirm clear all
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            data-testid="saved-clear-all"
            onClick={() => setConfirming(true)}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
