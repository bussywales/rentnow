"use client";

import { useRouter } from "next/navigation";
import { AdminReviewDrawer } from "@/components/admin/AdminReviewDrawer";
import { DrawerErrorBoundary } from "@/components/admin/AdminReviewShell";
import { formatLocationLine, type AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  listing: AdminReviewListItem;
  backHref?: string;
};

export default function AdminListingInspectorPanel({ listing, backHref = "/admin/listings" }: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-xl font-semibold text-slate-900">Listing inspector</h1>
          <p className="text-sm text-slate-600">Read-only detail view.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded border border-slate-300 px-3 py-1 text-sm"
        >
          Back to Listings
        </button>
      </div>

      <DrawerErrorBoundary selectedId={listing.id}>
        <AdminReviewDrawer
          listing={listing}
          onClose={() => router.push(backHref)}
          locationLine={formatLocationLine(listing)}
          onActionComplete={() => undefined}
          isHiddenByFilters={false}
          onShowHidden={() => undefined}
          filteredIds={[listing.id]}
          onNavigate={() => undefined}
          hasListings
          actionsEnabled={false}
        />
      </DrawerErrorBoundary>
    </div>
  );
}
