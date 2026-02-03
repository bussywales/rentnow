"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  open: boolean;
  listingTitle?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  submitting?: boolean;
  error?: string | null;
};

export function ListingReactivateModal({
  open,
  listingTitle,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reactivate-listing-title"
      data-testid="reactivate-listing-modal"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p id="reactivate-listing-title" className="text-sm font-semibold text-slate-900">
              Reactivate listing
            </p>
            <p className="text-xs text-slate-600">
              {listingTitle
                ? `"${listingTitle}" will go live again.`
                : "This listing will go live again."}
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close reactivate dialog"
          >
            x
          </button>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-slate-700">
            This will make the listing visible in search and on the public listing page.
          </p>
          {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={submitting} data-testid="reactivate-listing-confirm">
            {submitting ? "Reactivating..." : "Reactivate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
