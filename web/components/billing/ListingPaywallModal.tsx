"use client";

import { Button } from "@/components/ui/Button";
import { formatPriceValue } from "@/lib/property-discovery";

type Props = {
  open: boolean;
  amount?: number | null;
  currency: string;
  onClose: () => void;
  onPay?: () => void;
  onPlans?: () => void;
  loading?: boolean;
  error?: string | null;
  mode?: "listing" | "featured" | "listing_limit";
  preferPlans?: boolean;
  billingOnly?: boolean;
  closeLabel?: string;
  limitSummary?: {
    activeCount: number;
    maxListings: number;
    planName?: string | null;
    detail?: string | null;
  } | null;
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
  mode = "listing",
  preferPlans = false,
  billingOnly = false,
  closeLabel = "Save and exit",
  limitSummary = null,
}: Props) {
  if (!open) return null;
  const formatted =
    typeof amount === "number" && Number.isFinite(amount)
      ? formatPriceValue(currency, amount)
      : null;
  const isFeatured = mode === "featured";
  const isListingLimit = mode === "listing_limit";
  const title = isFeatured
    ? "Feature this listing"
    : isListingLimit
      ? "You've reached your active listing limit"
      : "Free posting limit reached";
  const description = isFeatured
    ? `You’re out of featured credits. Pay ${formatted} to feature now, or switch to a plan for monthly featured slots.`
    : isListingLimit
      ? limitSummary?.detail ||
        `You already have ${limitSummary?.activeCount ?? 0} active listings out of ${limitSummary?.maxListings ?? 0}. Upgrade your plan or manage active listings before continuing with this listing.`
    : billingOnly
      ? "Choose a plan before this listing can move back into review or live inventory."
      : `Choose a plan for lower per-listing costs, or pay ${formatted} to continue with this listing now.`;
  const productLabel = isFeatured
    ? "Pay-as-you-go featured fee"
    : isListingLimit
      ? limitSummary?.planName || "Active listing limit"
      : "Pay-as-you-go listing fee";
  const productDetail = isListingLimit
    ? `${limitSummary?.activeCount ?? 0} of ${limitSummary?.maxListings ?? 0} active listings in use`
    : `${formatted} (one-time)`;
  const primaryLabel = isFeatured ? `Pay ${formatted} to feature` : `Pay ${formatted} and publish`;
  const payLabel = isFeatured ? primaryLabel : `Pay ${formatted} for this listing`;
  const planLabel = isListingLimit ? "View plans" : "Continue to billing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4" role="dialog" aria-modal="true" aria-labelledby="payg-modal-title" data-testid="payg-modal">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p id="payg-modal-title" className="text-sm font-semibold text-slate-900">
              {title}
            </p>
            <p className="text-xs text-slate-600">
              {description}
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
            <p className="text-sm font-semibold text-slate-900">{productLabel}</p>
            <p className="text-xs text-slate-600">{productDetail}</p>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={loading}>
            {closeLabel}
          </Button>
          {preferPlans && onPlans ? (
            <>
              <Button size="sm" onClick={onPlans} disabled={loading} data-testid="payg-modal-plans">
                {planLabel}
              </Button>
              {!isListingLimit && !billingOnly && onPay ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onPay}
                  disabled={loading}
                  data-testid="payg-modal-pay"
                >
                  {loading ? "Opening checkout..." : payLabel}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {onPlans && (
                <Button size="sm" variant="secondary" onClick={onPlans} disabled={loading}>
                  See subscription plans
                </Button>
              )}
              {!isListingLimit && !billingOnly && onPay ? (
                <Button size="sm" onClick={onPay} disabled={loading} data-testid="payg-modal-pay">
                  {loading ? "Opening checkout..." : primaryLabel}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
