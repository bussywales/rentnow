"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { HostFeaturedStrip } from "@/components/host/HostFeaturedStrip";
import { HostListingsMasonryGrid } from "@/components/host/HostListingsMasonryGrid";
import { HostListingsRail } from "@/components/host/HostListingsRail";
import { parseHostDashboardView } from "@/components/host/useHostDashboardView";
import {
  readHostListingsView,
  writeHostListingsView,
  type HostListingsView,
} from "@/lib/host/listings-view-preference";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

type Props = {
  listings: DashboardListing[];
};

function getClientStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function HostListingsFeed({ listings }: Props) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<HostListingsView>(() =>
    readHostListingsView(getClientStorage())
  );
  const dashboardView = parseHostDashboardView(searchParams?.get("view"));
  const showFeaturedStrip = dashboardView === "all";

  const switchView = (nextView: HostListingsView) => {
    const resolved = writeHostListingsView(getClientStorage(), nextView);
    setView(resolved);
  };

  return (
    <section className="space-y-2" data-testid="host-home-listings-feed">
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-xs shadow-sm">
          <button
            type="button"
            onClick={() => switchView("grid")}
            className={`rounded-full px-2.5 py-1 font-semibold transition ${
              view === "grid" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-pressed={view === "grid"}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => switchView("rail")}
            className={`rounded-full px-2.5 py-1 font-semibold transition ${
              view === "rail" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-pressed={view === "rail"}
          >
            Rail
          </button>
        </div>
      </div>
      {view === "rail" ? (
        <HostListingsRail listings={listings} />
      ) : (
        <div className="space-y-3">
          {showFeaturedStrip ? <HostFeaturedStrip listings={listings} /> : null}
          <HostListingsMasonryGrid listings={listings} />
        </div>
      )}
    </section>
  );
}
