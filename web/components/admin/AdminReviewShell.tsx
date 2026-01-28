"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminReviewDrawer } from "@/components/admin/AdminReviewDrawer";
import {
  parseSelectedId,
  formatLocationLine,
  type AdminReviewListItem,
} from "@/lib/admin/admin-review";
import { useAdminReviewView } from "@/lib/admin/admin-review-view";

export class DrawerErrorBoundary extends React.Component<
  { selectedId: string | null; children: React.ReactNode },
  { hasError: boolean; message: string | null }
> {
  constructor(props: { selectedId: string | null; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Failed to render drawer" };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AdminReviewDrawer] render error", { error, errorInfo, selectedId: this.props.selectedId });
  }

  render() {
    if (this.state.hasError) {
      const debug = JSON.stringify({ selectedId: this.props.selectedId }, null, 2);
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-semibold text-amber-900">Failed to load selection</div>
          <div className="mt-1">{this.state.message}</div>
          <div className="mt-2 text-xs text-amber-700">Selected ID: {this.props.selectedId ?? "(none)"}</div>
          <div className="mt-3 flex gap-2 text-xs">
            <a className="font-semibold underline" href="/api/admin/review/diagnostics" target="_blank" rel="noreferrer">
              Diagnostics
            </a>
            <button
              type="button"
              className="rounded bg-amber-600 px-3 py-1 text-white"
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(debug);
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
              Retry render
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type RenderListArgs = {
  items: AdminReviewListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type Props = {
  listings: AdminReviewListItem[];
  initialSelectedId: string | null;
  renderList: (args: RenderListArgs) => React.ReactNode;
};

export function pickNextId(items: AdminReviewListItem[], removedId?: string | null) {
  return items.find((item) => item.id !== removedId)?.id ?? null;
}

export function AdminReviewShell({ listings, initialSelectedId, renderList }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { view } = useAdminReviewView();

  const [items, setItems] = useState<AdminReviewListItem[]>(listings);
  const selectedId = parseSelectedId(searchParams ?? {}) ?? initialSelectedId;

  const buildUrlWithId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams?.toString());
      if (id) params.set("id", id);
      else params.delete("id");
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const handleSelect = useCallback(
    (id: string) => {
      console.debug("[AdminReviewShell] select", { id, view });
      router.push(buildUrlWithId(id));
    },
    [buildUrlWithId, router, view]
  );

  const handleActionComplete = useCallback(
    (id: string) => {
      setItems((prev) => {
        const nextItems = prev.filter((item) => item.id !== id);
        const nextId = pickNextId(nextItems);
        router.push(buildUrlWithId(nextId));
        router.refresh();
        return nextItems;
      });
    },
    [buildUrlWithId, router]
  );

  const selectedListing = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  useEffect(() => {
    if (view === "pending" && !selectedId && items.length > 0) {
      router.replace(buildUrlWithId(items[0].id));
    }
  }, [view, selectedId, items, router, buildUrlWithId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">{renderList({ items, selectedId, onSelect: handleSelect })}</div>
      <DrawerErrorBoundary selectedId={selectedListing?.id ?? null}>
        <AdminReviewDrawer
          listing={selectedListing}
          onClose={() => router.push(buildUrlWithId(null))}
          locationLine={selectedListing ? formatLocationLine(selectedListing) : ""}
          onActionComplete={handleActionComplete}
          isHiddenByFilters={false}
          onShowHidden={() => undefined}
          filteredIds={items.map((i) => i.id)}
          onNavigate={(id) => handleSelect(id)}
          hasListings={items.length > 0}
        />
      </DrawerErrorBoundary>
    </div>
  );
}
