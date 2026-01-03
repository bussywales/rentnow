"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { filtersToChips, filtersToSearchParams } from "@/lib/search-filters";
import type { ParsedSearchFilters } from "@/lib/types";

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
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ParsedSearchFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  const chips = useMemo(() => (result ? filtersToChips(result) : []), [result]);

  const buildBrowseUrl = (filters: ParsedSearchFilters) => {
    const params = filtersToSearchParams(filters);
    const queryString = params.toString();
    return queryString ? `/properties?${queryString}` : "/properties";
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
  const submitLabel = isHome ? "Parse" : "Search";
  const placeholder = isHome
    ? 'e.g. "Furnished 2-bed in Nairobi under 600 dollars with parking"'
    : "Describe what you need (AI)";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Smart Search (AI)
          </h3>
          <p className="text-sm text-slate-600">
            Describe what you need and we convert it to structured filters.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Powered by OpenAI
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
        />
        <Button type="submit" disabled={loading}>
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
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
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
