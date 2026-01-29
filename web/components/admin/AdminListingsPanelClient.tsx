"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  listings: AdminReviewListItem[];
};

const LazyPanel = dynamic(() => import("./AdminListingsPanelContent"), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
      Loading listings panel…
    </div>
  ),
});

class ListingsPanelErrorBoundary extends React.Component<
  { debug: Record<string, unknown>; children: React.ReactNode },
  { hasError: boolean; message: string | null }
> {
  constructor(props: { debug: Record<string, unknown>; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Failed to load listings panel" };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AdminListingsPanel] render error", { error, errorInfo, debug: this.props.debug });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-semibold text-amber-950">Listings temporarily unavailable</div>
          <p className="mt-1">Check diagnostics or reload the page.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="rounded border border-amber-300 px-3 py-1 underline" href="/api/admin/review/diagnostics">
              Diagnostics
            </a>
            <button
              type="button"
              className="rounded border border-amber-300 px-3 py-1"
              onClick={() => this.setState({ hasError: false, message: null })}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminListingsPanelClient({ listings }: Props) {
  const debug = { listingCount: listings.length };
  return (
    <ListingsPanelErrorBoundary debug={debug}>
      <LazyPanel listings={listings} />
    </ListingsPanelErrorBoundary>
  );
}
