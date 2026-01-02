"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { SavedSearch } from "@/lib/types";

type Props = {
  initialSearches: SavedSearch[];
  alertsEnabled?: boolean;
};

type MatchResult = {
  total: number;
  sampleIds: string[];
};

function formatSummary(search: SavedSearch) {
  const params = search.query_params || {};
  const parts: string[] = [];
  if (typeof params.city === "string") parts.push(params.city);
  if (typeof params.rentalType === "string") {
    parts.push(params.rentalType === "short_let" ? "Short-let" : "Long-term");
  }
  if (typeof params.bedrooms === "number") parts.push(`${params.bedrooms}+ beds`);
  if (typeof params.minPrice === "number" || typeof params.maxPrice === "number") {
    parts.push(
      `Price ${params.minPrice ?? "min"}-${params.maxPrice ?? "max"}`
    );
  }
  return parts.length ? parts.join(" • ") : "All listings";
}

export function SavedSearchManager({ initialSearches, alertsEnabled = false }: Props) {
  const [searches, setSearches] = useState(initialSearches);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, MatchResult>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const startEdit = (search: SavedSearch) => {
    setEditingId(search.id);
    setNameDraft(search.name);
  };

  const saveName = async (search: SavedSearch) => {
    setError(null);
    const res = await fetch(`/api/saved-searches/${search.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraft }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Unable to rename search.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSearches((prev) =>
      prev.map((item) => (item.id === search.id ? data.search : item))
    );
    setEditingId(null);
  };

  const deleteSearch = async (search: SavedSearch) => {
    setError(null);
    const res = await fetch(`/api/saved-searches/${search.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Unable to delete search.");
      return;
    }
    setSearches((prev) => prev.filter((item) => item.id !== search.id));
  };

  const checkMatches = async (search: SavedSearch) => {
    setError(null);
    setCheckingId(search.id);
    const res = await fetch(`/api/saved-searches/${search.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check" }),
    });
    setCheckingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Unable to check matches.");
      return;
    }
    const data = await res.json();
    setMatches((prev) => ({ ...prev, [search.id]: data }));
    setSearches((prev) =>
      prev.map((item) =>
        item.id === search.id
          ? { ...item, last_checked_at: new Date().toISOString() }
          : item
      )
    );
  };

  if (!searches.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <p className="text-base font-semibold text-slate-900">No saved searches yet</p>
        <p className="mt-1 text-sm text-slate-600">
          Save a search from the browse page to build alert foundations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {searches.map((search) => {
        const result = matches[search.id];
        return (
          <div
            key={search.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {editingId === search.id ? (
                    <Input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="h-8 w-56"
                    />
                  ) : (
                    search.name
                  )}
                </p>
                {alertsEnabled && (
                  <p className="text-xs font-semibold text-emerald-600">Alerts enabled</p>
                )}
                <p className="text-xs text-slate-600">{formatSummary(search)}</p>
                {search.last_checked_at && (
                  <p className="text-xs text-slate-500">
                    Last checked: {new Date(search.last_checked_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {editingId === search.id ? (
                  <Button size="sm" onClick={() => saveName(search)}>
                    Save name
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => startEdit(search)}>
                    Rename
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => checkMatches(search)}
                  disabled={checkingId === search.id}
                >
                  {checkingId === search.id ? "Checking..." : "Check matches"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteSearch(search)}>
                  Delete
                </Button>
              </div>
            </div>
            {result && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold">Matches found: {result.total}</p>
                {result.sampleIds?.length ? (
                  <p className="mt-1">Sample IDs: {result.sampleIds.join(", ")}</p>
                ) : (
                  <p className="mt-1">No matching listings yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
