"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ParsedSearchFilters } from "@/lib/types";

type Props = {
  filters: ParsedSearchFilters;
  savedSearchesHref: string;
};

function buildDefaultName(filters: ParsedSearchFilters) {
  if (filters.city) return `${filters.city} rentals`;
  if (filters.rentalType) return `${filters.rentalType === "short_let" ? "Short-let" : "Long-term"} search`;
  return "Followed search";
}

export function SavedSearchButton({ filters, savedSearchesHref }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(buildDefaultName(filters));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [reasonCode, setReasonCode] = useState<string | null>(null);

  const payload = useMemo(() => ({
    city: filters.city,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    currency: filters.currency,
    bedrooms: filters.bedrooms,
    bedroomsMode: filters.bedroomsMode ?? "exact",
    includeSimilarOptions: Boolean(filters.includeSimilarOptions),
    propertyType: filters.propertyType ?? null,
    intent: filters.listingIntent ?? "all",
    rentalType: filters.rentalType,
    furnished: filters.furnished,
    amenities: filters.amenities,
  }), [filters]);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => setToastVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setReasonCode(null);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          filters: payload,
          source: "browse",
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setReasonCode("not_authenticated");
          throw new Error("Please log in to follow searches.");
        }
        const data = await res.json().catch(() => ({}));
        if (typeof data?.code === "string") setReasonCode(data.code);
        throw new Error(data?.error || "Unable to follow search.");
      }
      setToastVisible(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to follow search.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Follow this search
        </Button>
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
      {toastVisible ? (
        <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
          <div className="pointer-events-auto rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">Search followed.</p>
              <button
                type="button"
                onClick={() => setToastVisible(false)}
                className="rounded p-1 text-xs text-emerald-700 hover:bg-emerald-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <Link
              href={savedSearchesHref}
              onClick={() => setToastVisible(false)}
              className="mt-2 inline-flex rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              View saved searches
            </Link>
          </div>
        </div>
      ) : null}
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Follow search</h3>
              <p className="text-sm text-slate-600">
                Follow these filters to track new matches in your saved searches.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <label htmlFor="saved-search-name" className="text-sm font-medium text-slate-700">
                Search name (optional)
              </label>
              <Input
                id="saved-search-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Following..." : "Follow search"}
              </Button>
            </div>
            {error && (
              <p className="mt-3 text-xs text-rose-600">
                {error}{" "}
                {reasonCode === "not_authenticated" && (
                  <Link href="/auth/login" className="underline">
                    Log in
                  </Link>
                )}
                {reasonCode === "limit_reached" && (
                  <Link href="/tenant/billing#plans" className="underline">
                    Upgrade to Tenant Pro
                  </Link>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
