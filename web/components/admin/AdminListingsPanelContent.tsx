"use client";

import { AdminReviewShell } from "@/components/admin/AdminReviewShell";
import { AdminListingsTable } from "@/components/admin/AdminListingsTable";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  listings: AdminReviewListItem[];
  initialSelectedId: string | null;
};

export default function AdminListingsPanelContent({ listings, initialSelectedId }: Props) {
  return (
    <AdminReviewShell
      listings={listings}
      initialSelectedId={initialSelectedId}
      autoSelect={false}
      removeOnAction={false}
      renderList={({ items, selectedId, onSelect }) => (
        <AdminListingsTable items={items} selectedId={selectedId} onSelect={onSelect} />
      )}
    />
  );
}
