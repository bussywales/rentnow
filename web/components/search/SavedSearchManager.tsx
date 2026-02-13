"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { filtersToSearchParams, parseFiltersFromSavedSearch } from "@/lib/search-filters";
import { parseIntent } from "@/lib/search-intent";
import type { SavedSearch } from "@/lib/types";
import { setToastQuery } from "@/lib/utils/toast";

type Props = {
  initialSearches: SavedSearch[];
  alertsEnabled?: boolean;
};

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function formatSummary(search: SavedSearch) {
  const params = search.query_params || {};
  const parts: string[] = [];
  if (typeof params.city === "string") parts.push(params.city);
  if (typeof params.intent === "string" || typeof params.listingIntent === "string") {
    const intent =
      (typeof params.intent === "string" ? params.intent : params.listingIntent) ?? "all";
    if (intent === "buy") parts.push("For sale");
    if (intent === "rent") parts.push("For rent");
  }
  if (typeof params.rentalType === "string") {
    parts.push(params.rentalType === "short_let" ? "Short-let" : "Long-term");
  }
  if (typeof params.bedrooms === "number") parts.push(`${params.bedrooms}+ beds`);
  if (typeof params.minPrice === "number" || typeof params.maxPrice === "number") {
    parts.push(
      `Price ${params.minPrice ?? "min"}-${params.maxPrice ?? "max"}`
    );
  }
  return parts.length ? parts.join(" • ") : "All homes";
}

function buildViewMatchesHref(search: SavedSearch) {
  const filters = parseFiltersFromSavedSearch(search.query_params || {});
  const params = filtersToSearchParams(filters);
  if (!params.get("intent")) {
    params.set("intent", filters.listingIntent ?? "all");
  }
  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}

export function SavedSearchManager({ initialSearches, alertsEnabled = false }: Props) {
  const router = useRouter();
  const [searches, setSearches] = useState(initialSearches);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const sanitizeError = (message: string, fallback: string) => {
    const cleaned = message.replace(UUID_REGEX, "").replace(/\s{2,}/g, " ").trim();
    return cleaned || fallback;
  };

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
      setError(sanitizeError(data?.error || "", "Unable to rename search."));
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSearches((prev) =>
      prev.map((item) => (item.id === search.id ? data.search : item))
    );
    setEditingId(null);
  };

  const toggleActive = async (search: SavedSearch) => {
    setError(null);
    const nextIsActive = search.is_active === false;
    const res = await fetch(`/api/saved-searches/${search.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: nextIsActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(sanitizeError(data?.error || "", "Unable to update this search."));
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSearches((prev) =>
      prev.map((item) => (item.id === search.id ? data.search : item))
    );
  };

  const toggleAlertsEnabled = async (search: SavedSearch) => {
    setError(null);
    const nextAlertsEnabled = search.alerts_enabled === false;
    const res = await fetch(`/api/saved-searches/${search.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alerts_enabled: nextAlertsEnabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(sanitizeError(data?.error || "", "Unable to update alert settings."));
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSearches((prev) =>
      prev.map((item) => (item.id === search.id ? data.search : item))
    );
  };

  const updateAlertFrequency = async (
    search: SavedSearch,
    nextFrequency: "instant" | "daily" | "weekly"
  ) => {
    setError(null);
    const res = await fetch(`/api/saved-searches/${search.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert_frequency: nextFrequency }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(sanitizeError(data?.error || "", "Unable to update alert frequency."));
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSearches((prev) =>
      prev.map((item) => (item.id === search.id ? data.search : item))
    );
  };

  const deleteSearch = async (search: SavedSearch) => {
    setError(null);
    const res = await fetch(`/api/saved-searches/${search.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(sanitizeError(data?.error || "", "Unable to delete search."));
      return;
    }
    setSearches((prev) => prev.filter((item) => item.id !== search.id));
  };

  const checkMatches = async (search: SavedSearch) => {
    setError(null);
    setNotice(null);
    setCheckingId(search.id);
    try {
      const res = await fetch(`/api/saved-searches/${search.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice("We couldn't check matches. Please try again.");
        return;
      }
      const matchCount =
        typeof data?.matchCount === "number" ? data.matchCount : null;
      const savedSearchId =
        typeof data?.savedSearchId === "string" ? data.savedSearchId : search.id;
      const checkedAt =
        typeof data?.checkedAt === "string" ? data.checkedAt : null;
      setSearches((prev) =>
        prev.map((item) =>
          item.id === search.id
            ? { ...item, last_checked_at: checkedAt ?? new Date().toISOString() }
            : item
        )
      );
      const params = new URLSearchParams();
      params.set("savedSearchId", savedSearchId);
      params.set("source", "saved-search");
      const intent =
        parseIntent(
          typeof search.query_params?.intent === "string"
            ? search.query_params.intent
            : typeof search.query_params?.listingIntent === "string"
            ? search.query_params.listingIntent
            : null
        ) ?? "all";
      params.set("intent", intent);
      const message =
        typeof matchCount === "number" && matchCount > 0
          ? `Found ${matchCount} matches — opening homes...`
          : "No matches yet — we'll show your saved search filters.";
      const shouldCelebrate = typeof matchCount === "number" && matchCount > 0;
      setToastQuery(params, message, shouldCelebrate ? "success" : "info");
      router.push(`/properties?${params.toString()}`);
    } catch {
      setNotice("We couldn't check matches. Please try again.");
    } finally {
      setCheckingId(null);
    }
  };

  if (!searches.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <p className="text-base font-semibold text-slate-900">
          No saved searches yet — follow one to get instant match updates.
        </p>
        <Link
          href="/properties"
          className="mt-3 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
        >
          Browse homes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notice && (
        <Alert
          title="Heads up"
          description={notice}
          variant="warning"
          className="text-left"
        />
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {searches.map((search) => (
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
              <p className="text-xs font-semibold text-slate-600">
                {search.is_active === false ? "Paused" : "Active"}
              </p>
              {alertsEnabled && <p className="text-xs font-semibold text-emerald-600">Alerts available</p>}
              <p className="text-xs text-slate-600">{formatSummary(search)}</p>
              {search.last_checked_at && (
                <p className="text-xs text-slate-500">
                  Last checked: {new Date(search.last_checked_at).toLocaleString()}
                </p>
              )}
              <Link
                href={buildViewMatchesHref(search)}
                className="text-xs font-semibold text-sky-700 transition hover:text-sky-800"
              >
                View matches
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Email alerts</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleAlertsEnabled(search)}
                >
                  {search.alerts_enabled === false ? "Off" : "On"}
                </Button>
                <label htmlFor={`frequency-${search.id}`} className="sr-only">
                  Alert frequency
                </label>
                <select
                  id={`frequency-${search.id}`}
                  value={search.alert_frequency ?? "daily"}
                  onChange={(event) =>
                    void updateAlertFrequency(
                      search,
                      event.target.value as "instant" | "daily" | "weekly"
                    )
                  }
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                  disabled={search.alerts_enabled === false}
                >
                  <option value="instant">Instant</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                Instant: email when new matches appear (rate-limited). Daily/Weekly: digest.
              </p>
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
                {checkingId === search.id ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-slate-700"
                      aria-hidden="true"
                    />
                    Checking...
                  </span>
                ) : (
                  "Check matches"
                )}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toggleActive(search)}
              >
                {search.is_active === false ? "Resume" : "Pause"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteSearch(search)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
