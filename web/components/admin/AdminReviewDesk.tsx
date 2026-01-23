 "use client";

import { useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import {
  buildSelectedUrl,
  parseSelectedId,
  type AdminReviewListItem,
  formatLocationLine,
} from "@/lib/admin/admin-review";
import { AdminReviewDrawer } from "./AdminReviewDrawer";
import { AdminReviewList } from "./AdminReviewList";
import { useState } from "react";

type Props = {
  listings: AdminReviewListItem[];
  initialSelectedId: string | null;
  canonicalPath: string;
};

export function AdminReviewDesk({ listings, initialSelectedId, canonicalPath }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AdminReviewListItem[]>(listings);
  const selectedId = parseSelectedId(searchParams ?? {}) ?? initialSelectedId;

  const selectedListing = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const handleSelect = useCallback(
    (id: string) => {
      router.push(buildSelectedUrl(canonicalPath || pathname, id));
    },
    [canonicalPath, pathname, router]
  );

  const handleClose = useCallback(() => {
    router.push(canonicalPath || pathname);
  }, [canonicalPath, pathname, router]);

  const handleActionComplete = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedId === id) {
        router.push(canonicalPath || pathname);
      }
    },
    [canonicalPath, pathname, router, selectedId]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{ADMIN_REVIEW_COPY.list.columns.title}</p>
              <p className="text-xs text-slate-600">Showing {items.length}</p>
            </div>
          </div>
        </div>
        <AdminReviewList listings={items} onSelect={handleSelect} selectedId={selectedId} />
        {items.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{ADMIN_REVIEW_COPY.list.emptyTitle}</p>
            <p className="text-slate-600">{ADMIN_REVIEW_COPY.list.emptyBody}</p>
          </div>
        )}
      </div>

      <AdminReviewDrawer
        listing={selectedListing}
        onClose={handleClose}
        locationLine={selectedListing ? formatLocationLine(selectedListing) : ""}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
