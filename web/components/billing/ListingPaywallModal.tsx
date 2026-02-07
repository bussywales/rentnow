"use client";

import { Button } from "@/components/ui/Button";
import { formatPriceValue } from "@/lib/property-discovery";

type Props = {
  open: boolean;
  amount: number;
  currency: string;
  onClose: () => void;
  onPay: () => void;
  onPlans?: () => void;
  loading?: boolean;
  error?: string | null;
};

export function ListingPaywallModal({
  open,
  amount,
  currency,
  onClose,
  onPay,
  onPlans,
  loading,
  error,
}: Props) {
  if (!open) return null;
  const formatted = formatPriceValue(currency, amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4" role="dialog" aria-modal="true" aria-labelledby="payg-modal-title" data-testid="payg-modal">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p id="payg-modal-title" className="text-sm font-semibold text-slate-900">
              Publish this listing
            </p>
            <p className="text-xs text-slate-600">
              You’re out of listing credits. Pay {formatted} to publish now, or switch to a plan for lower per-listing costs.
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close paywall dialog"
          >
            x
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-sm font-semibold text-slate-900">Pay-as-you-go listing fee</p>
            <p className="text-xs text-slate-600">{formatted} (one-time)</p>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          {onPlans && (
            <Button size="sm" variant="secondary" onClick={onPlans} disabled={loading}>
              See subscription plans
            </Button>
          )}
          <Button size="sm" onClick={onPay} disabled={loading} data-testid="payg-modal-pay">
            {loading ? "Opening checkout..." : `Pay ${formatted} and publish`}
          </Button>
        </div>
      </div>
    </div>
  );
}
