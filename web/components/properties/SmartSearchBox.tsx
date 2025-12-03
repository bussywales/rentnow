"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ParsedSearchFilters } from "@/lib/types";

type Props = {
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

export function SmartSearchBox({ onFilters }: Props) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ParsedSearchFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (data?.filters) {
        setResult(data.filters);
        onFilters?.(data.filters);
      } else {
        setResult(emptyFilters);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to parse search right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
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
          placeholder='e.g. "Furnished 2-bed in Nairobi under 600 dollars with parking"'
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Parse"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <pre className="mt-3 rounded-lg bg-slate-900/90 p-3 text-xs text-slate-100">
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
