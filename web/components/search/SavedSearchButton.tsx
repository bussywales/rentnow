"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ParsedSearchFilters } from "@/lib/types";

type Props = {
  filters: ParsedSearchFilters;
};

function buildDefaultName(filters: ParsedSearchFilters) {
  if (filters.city) return `${filters.city} rentals`;
  if (filters.rentalType) return `${filters.rentalType === "short_let" ? "Short-let" : "Long-term"} search`;
  return "My saved search";
}

export function SavedSearchButton({ filters }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(buildDefaultName(filters));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const payload = useMemo(() => ({
    city: filters.city,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    currency: filters.currency,
    bedrooms: filters.bedrooms,
    rentalType: filters.rentalType,
    furnished: filters.furnished,
    amenities: filters.amenities,
  }), [filters]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setLimitReached(false);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, query_params: payload }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Please log in to save searches.");
        }
        const data = await res.json().catch(() => ({}));
        if (data?.code === "plan_limit_reached") {
          setLimitReached(true);
        }
        throw new Error(data?.error || "Unable to save search.");
      }
      setSuccess("Saved! You can manage alerts in your dashboard.");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save search.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Save this search
        </Button>
        {success && <span className="text-xs text-emerald-600">{success}</span>}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Save search</h3>
              <p className="text-sm text-slate-600">
                Give this search a name so you can track new listings later.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <label htmlFor="saved-search-name" className="text-sm font-medium text-slate-700">
                Search name
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
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Save search"}
              </Button>
            </div>
            {error && (
              <p className="mt-3 text-xs text-rose-600">
            {error}{" "}
            {error.toLowerCase().includes("log in") && (
              <Link href="/auth/login" className="underline">
                Log in
              </Link>
            )}
            {limitReached && (
              <Link href="/dashboard/billing#plans" className="underline">
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
