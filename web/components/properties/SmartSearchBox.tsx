"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { filtersToChips } from "@/lib/search-filters";
import type { ParsedSearchFilters } from "@/lib/types";
import { buildSearchHref, LAST_SEARCH_STORAGE_KEY } from "@/lib/search/last-search";
import { parseIntent } from "@/lib/search-intent";

type Props = {
  mode?: "home" | "browse";
  onFilters?: (filters: ParsedSearchFilters) => void;
};

const emptyFilters: ParsedSearchFilters = {
  city: null,
  minPrice: null,
  maxPrice: null,
  currency: null,
  bedrooms: null,
  rentalType: null,
  furnished: null,
  amenities: [],
};

export function SmartSearchBox({ onFilters, mode = "home" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ParsedSearchFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  const chips = useMemo(() => (result ? filtersToChips(result) : []), [result]);

  const buildBrowseUrl = (filters: ParsedSearchFilters) => {
    const href = buildSearchHref(filters);
    if (mode !== "browse") return href;

    const currentIntent = parseIntent(searchParams.get("intent"));
    const currentStay = searchParams.get("stay");

    const [basePath, existingQuery = ""] = href.split("?");
    const next = new URLSearchParams(existingQuery);
    if (currentIntent && !next.get("intent")) {
      next.set("intent", currentIntent);
    }
    if (currentStay === "shortlet" && !next.get("stay")) {
      next.set("stay", "shortlet");
    }
    const queryString = next.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/parse-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      const filters = data?.filters ?? emptyFilters;
      setResult(filters);
      onFilters?.(filters);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            LAST_SEARCH_STORAGE_KEY,
            JSON.stringify({
              query,
              filters,
              updatedAt: new Date().toISOString(),
            })
          );
        } catch {
          // ignore storage write failures
        }
      }
      if (mode === "browse") {
        router.push(buildBrowseUrl(filters));
      }
    } catch (err) {
      console.error(err);
      setError("Unable to parse search right now.");
    } finally {
      setLoading(false);
    }
  };

  const isHome = mode === "home";
  const submitLabel = isHome ? "Search" : "Search";
  const placeholder = isHome
    ? "Furnished 2-bed in Nairobi under $600, parking included"
    : "Describe what you need";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Smart search
          </h3>
          <p className="text-sm text-slate-500">
            Tell us what you’re looking for and we’ll turn it into precise results.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
          Powered by intelligent search
        </span>
      </div>
      <form
        className="mt-4 flex flex-col gap-3 md:flex-row"
        onSubmit={handleSubmit}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="rounded-full border-slate-200/80 bg-white px-5 py-3 text-sm shadow-[0_6px_20px_rgba(15,23,42,0.08)] focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
        />
        <Button
          type="submit"
          disabled={loading}
          className="rounded-full px-6 shadow-[0_6px_16px_rgba(14,165,233,0.2)]"
        >
          {loading ? "Thinking..." : submitLabel}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {isHome && result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Detected filters
            </p>
            {chips.length ? (
              chips.map((chip) => (
                <span
                  key={`${chip.label}-${chip.value}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
                >
                  {chip.label}: {chip.value}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No filters detected yet.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => router.push(buildBrowseUrl(result))}>
              Search properties
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowJson((prev) => !prev)}
            >
              {showJson ? "Hide JSON" : "View JSON"}
            </Button>
          </div>
          {showJson && (
            <pre className="rounded-lg bg-slate-900/90 p-3 text-xs text-slate-100">
{JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
