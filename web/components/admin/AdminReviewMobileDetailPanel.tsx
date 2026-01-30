"use client";

import { useRouter } from "next/navigation";
import { AdminReviewDrawer } from "@/components/admin/AdminReviewDrawer";
import { DrawerErrorBoundary } from "@/components/admin/AdminReviewShell";
import { formatLocationLine, type AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  listing: AdminReviewListItem;
  backHref: string;
};

export default function AdminReviewMobileDetailPanel({ listing, backHref }: Props) {
  const router = useRouter();
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <DrawerErrorBoundary selectedId={listing.id}>
        <AdminReviewDrawer
          listing={listing}
          onClose={() => router.push(backHref, { scroll: false })}
          locationLine={formatLocationLine(listing)}
          onActionComplete={() => router.push(backHref, { scroll: false })}
          isHiddenByFilters={false}
          onShowHidden={() => undefined}
          filteredIds={[listing.id]}
          onNavigate={() => undefined}
          hasListings
          actionsEnabled
        />
      </DrawerErrorBoundary>
    </div>
  );
}
