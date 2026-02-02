"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DEFAULT_LISTING_EXPIRY_DAYS, MAX_LISTING_EXPIRY_DAYS, MIN_LISTING_EXPIRY_DAYS } from "@/lib/properties/expiry";

type Props = {
  expiryDays: number;
  expiryUpdatedAt: string | null;
  showExpiredPublic: boolean;
  showExpiredUpdatedAt: string | null;
};

export default function AdminSettingsListingExpiry({
  expiryDays,
  expiryUpdatedAt,
  showExpiredPublic,
  showExpiredUpdatedAt,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState<number>(expiryDays);
  const [showExpired, setShowExpired] = useState<boolean>(showExpiredPublic);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const saveDays = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "listing_expiry_days",
          value: { days },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not update listing expiry days");
        return;
      }
      setToast("Updated listing expiry window.");
    });
  };

  const toggleExpiredPublic = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      const next = !showExpired;
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "show_expired_listings_public",
          value: { enabled: next },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not update expired listing visibility");
        return;
      }
      setShowExpired(next);
      setToast(
        next
          ? "Expired listings are now visible via direct links."
          : "Expired listings are hidden from the public."
      );
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Listing expiry</h2>
          <p className="text-sm text-slate-600">
            Control how long listings stay live before expiring.
          </p>
          {expiryUpdatedAt && (
            <p className="text-xs text-slate-500">
              Last updated {new Date(expiryUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-slate-500" htmlFor="expiry-days">
            Expiry (days)
          </label>
          <input
            id="expiry-days"
            type="number"
            min={MIN_LISTING_EXPIRY_DAYS}
            max={MAX_LISTING_EXPIRY_DAYS}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            disabled={pending}
          />
          <Button size="sm" onClick={saveDays} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Default is {DEFAULT_LISTING_EXPIRY_DAYS} days (min {MIN_LISTING_EXPIRY_DAYS}, max {MAX_LISTING_EXPIRY_DAYS}).
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Show expired listings publicly</p>
          <p className="text-xs text-slate-600">
            When enabled, expired listings are viewable via direct links only.
          </p>
          {showExpiredUpdatedAt && (
            <p className="text-xs text-slate-500">
              Last updated {new Date(showExpiredUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant={showExpired ? "secondary" : "primary"}
          disabled={pending}
          onClick={toggleExpiredPublic}
        >
          {pending ? "Saving..." : showExpired ? "Disable" : "Enable"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {toast && <p className="mt-2 text-xs text-emerald-600">{toast}</p>}
    </div>
  );
}
