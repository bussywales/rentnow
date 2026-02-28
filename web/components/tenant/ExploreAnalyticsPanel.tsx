"use client";

import { useMemo, useState } from "react";
import { buildExploreAnalyticsCsv } from "@/lib/explore/explore-analytics-export";
import {
  clearExploreAnalyticsEvents,
  getExploreAnalyticsEvents,
  type ExploreAnalyticsEvent,
} from "@/lib/explore/explore-analytics";

function downloadExploreAnalyticsCsv(csv: string, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function formatEventPreview(event: ExploreAnalyticsEvent): string {
  const listing = event.listingId ? `listing ${event.listingId}` : "session";
  const idx = Number.isFinite(event.index) ? `#${(event.index ?? 0) + 1}` : "";
  return `${event.name} ${idx} ${listing}`.trim();
}

export function ExploreAnalyticsPanel() {
  const [events, setEvents] = useState<ExploreAnalyticsEvent[]>(() => getExploreAnalyticsEvents());
  const [feedback, setFeedback] = useState<string | null>(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.at.localeCompare(b.at));
  }, [events]);

  const handleExport = () => {
    const csv = buildExploreAnalyticsCsv(sortedEvents);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadExploreAnalyticsCsv(csv, `explore-funnel-${stamp}.csv`);
    setFeedback("CSV downloaded.");
  };

  const handleClear = () => {
    const next = clearExploreAnalyticsEvents();
    setEvents(next);
    setFeedback("Local analytics cleared.");
  };

  return (
    <section
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid="tenant-explore-analytics-panel"
    >
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Explore funnel analytics (local)</h1>
        <p className="text-sm text-slate-600">
          Export local Explore events for debugging. No message content or contact details are stored.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!sortedEvents.length}
          data-testid="tenant-explore-analytics-export"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!sortedEvents.length}
          data-testid="tenant-explore-analytics-clear"
        >
          Clear local analytics
        </button>
        <span className="text-xs text-slate-500" data-testid="tenant-explore-analytics-count">
          {sortedEvents.length} event{sortedEvents.length === 1 ? "" : "s"}
        </span>
      </div>

      {feedback ? (
        <p className="text-xs text-emerald-700" data-testid="tenant-explore-analytics-feedback">
          {feedback}
        </p>
      ) : null}

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {sortedEvents.length ? (
          sortedEvents.slice(-8).reverse().map((event) => (
            <div
              key={`${event.at}:${event.name}:${event.listingId ?? "none"}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              data-testid="tenant-explore-analytics-row"
            >
              <span className="font-semibold text-slate-700">{formatEventPreview(event)}</span>
              <span className="shrink-0">{new Date(event.at).toLocaleString()}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600" data-testid="tenant-explore-analytics-empty">
            No local Explore events yet.
          </p>
        )}
      </div>
    </section>
  );
}
