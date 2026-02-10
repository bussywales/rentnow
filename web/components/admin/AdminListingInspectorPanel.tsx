"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminReviewDrawer } from "@/components/admin/AdminReviewDrawer";
import { DrawerErrorBoundary } from "@/components/admin/AdminReviewShell";
import { formatLocationLine, type AdminReviewListItem } from "@/lib/admin/admin-review";
import AdminDemoToggleButton from "@/components/admin/AdminDemoToggleButton";

type Props = {
  listing: AdminReviewListItem;
  backHref?: string;
};

export default function AdminListingInspectorPanel({ listing, backHref = "/admin/listings" }: Props) {
  const router = useRouter();
  const [overrideDemo, setOverrideDemo] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const isDemo = overrideDemo ?? !!listing.is_demo;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-xl font-semibold text-slate-900">Listing inspector</h1>
          <p className="text-sm text-slate-600">Review details and apply admin controls.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded border border-slate-300 px-3 py-1 text-sm"
        >
          Back to Listings
        </button>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Demo listing (Admin control)</h2>
            <p className="text-sm text-slate-600">
              Demo status is set by the listing owner or an admin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDemo ? (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                Demo
              </span>
            ) : null}
            <AdminDemoToggleButton
              propertyId={listing.id}
              isDemo={isDemo}
              onUpdated={(next) => setOverrideDemo(next)}
              onToast={(message) => {
                setToast(message);
                setTimeout(() => setToast(null), 2000);
              }}
              dataTestId="admin-inspector-demo-toggle"
            />
          </div>
        </div>
        {toast ? <p className="mt-2 text-xs text-emerald-600">{toast}</p> : null}
      </section>

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
