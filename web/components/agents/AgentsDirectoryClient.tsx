"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AgentCard, type DirectoryAgentCardItem } from "@/components/agents/AgentCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const REQUEST_DEBOUNCE_MS = 260;
const DEFAULT_LIMIT = 24;

type AgentsDirectoryPayload = {
  items: DirectoryAgentCardItem[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
};

type Props = {
  initialData: AgentsDirectoryPayload;
};

function buildSearchParams(input: {
  query: string;
  location: string;
  verifiedOnly: boolean;
  limit: number;
  offset: number;
}) {
  const params = new URLSearchParams();
  const query = input.query.trim();
  const location = input.location.trim();
  if (query) params.set("q", query);
  if (location) params.set("location", location);
  params.set("verified", input.verifiedOnly ? "1" : "0");
  params.set("limit", String(input.limit));
  params.set("offset", String(input.offset));
  return params;
}

export function AgentsDirectoryClient({ initialData }: Props) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [payload, setPayload] = useState<AgentsDirectoryPayload>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (!isHydratedRef.current) {
      isHydratedRef.current = true;
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = buildSearchParams({
          query,
          location,
          verifiedOnly,
          limit: DEFAULT_LIMIT,
          offset: 0,
        });
        const response = await fetch(`/api/agents/search?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("We couldn't load agents right now.");
        }
        const body = (await response.json()) as AgentsDirectoryPayload;
        setPayload({
          items: Array.isArray(body.items) ? body.items : [],
          total: Number.isFinite(body.total) ? body.total : 0,
          hasMore: !!body.hasMore,
          limit: Number.isFinite(body.limit) ? body.limit : DEFAULT_LIMIT,
          offset: Number.isFinite(body.offset) ? body.offset : 0,
        });
      } catch (fetchError) {
        if (
          fetchError &&
          typeof fetchError === "object" &&
          "name" in fetchError &&
          fetchError.name === "AbortError"
        ) {
          return;
        }
        setError("We couldn't load agents right now. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }, REQUEST_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [location, query, verifiedOnly]);

  const visibleCount = payload.items.length;
  const summaryLabel =
    payload.total > 0
      ? `${payload.total} ${payload.total === 1 ? "agent" : "agents"}`
      : "No matching agents";

  return (
    <section className="space-y-5" data-testid="agents-directory-page">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agents</p>
        <h1 className="text-3xl font-semibold text-slate-900">Find an agent</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Verified agents to help you rent, sell, and manage viewings.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="agents-directory-filters">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or company"
              data-testid="agents-directory-search"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Location</span>
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City or country"
              data-testid="agents-directory-location"
            />
          </label>
          <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => setVerifiedOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              data-testid="agents-directory-verified-toggle"
            />
            <span>Verified only</span>
          </label>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-slate-600" data-testid="agents-directory-summary">
          {summaryLabel}
        </p>
        {isLoading ? (
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Updating...
          </span>
        ) : null}
      </div>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {visibleCount > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="agents-directory-results">
          {payload.items.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h2 className="text-xl font-semibold text-slate-900">No verified agents yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            We'll surface verified agents here as new profiles complete trust checks.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href="/properties">
              <Button variant="secondary">Browse listings</Button>
            </Link>
            <Link href="/account/verification">
              <Button>Become a verified agent</Button>
            </Link>
          </div>
        </section>
      )}

      {payload.hasMore ? (
        <p className="text-center text-xs text-slate-500">
          More agents are available. Refine your filters to narrow results.
        </p>
      ) : null}
    </section>
  );
}
