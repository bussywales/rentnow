"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  listings: AdminReviewListItem[];
  initialSelectedId: string | null;
};

const LazyPanel = dynamic(() => import("./AdminReviewPanelContent"), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
      Loading review panel…
    </div>
  ),
});

class PanelErrorBoundary extends React.Component<
  { debug: Record<string, unknown>; children: React.ReactNode },
  { hasError: boolean; message: string | null }
> {
  constructor(props: { debug: Record<string, unknown>; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Failed to load review panel" };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AdminReviewPanel] render error", { error, errorInfo, debug: this.props.debug });
  }

  render() {
    if (this.state.hasError) {
      const debugJson = JSON.stringify(this.props.debug, null, 2);
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-semibold text-amber-950">Review temporarily unavailable</div>
          <p className="mt-1">Open the dedicated review desk or diagnostics while we retry.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="rounded border border-amber-300 px-3 py-1 underline" href="/admin/review">
              Open /admin/review
            </a>
            <a
              className="rounded border border-amber-300 px-3 py-1 underline"
              href="/api/admin/review/diagnostics"
              target="_blank"
              rel="noreferrer"
            >
              Diagnostics
            </a>
            <button
              type="button"
              className="rounded border border-amber-300 px-3 py-1"
              onClick={() => {
                try {
                  void navigator.clipboard?.writeText(debugJson);
                } catch {
                  /* ignore */
                }
              }}
            >
              Copy debug JSON
            </button>
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

export default function AdminReviewPanelClient({ listings, initialSelectedId }: Props) {
  const debug = useMemo(
    () => ({
      listingCount: listings.length,
      initialSelectedId,
    }),
    [listings.length, initialSelectedId]
  );

  return (
    <PanelErrorBoundary debug={debug}>
      <LazyPanel listings={listings} initialSelectedId={initialSelectedId} />
    </PanelErrorBoundary>
  );
}
