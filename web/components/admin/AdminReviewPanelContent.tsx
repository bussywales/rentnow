"use client";

import { AdminReviewShell } from "@/components/admin/AdminReviewShell";
import { AdminReviewListCards } from "@/components/admin/AdminReviewListCards";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  listings: AdminReviewListItem[];
  initialSelectedId: string | null;
};

export default function AdminReviewPanelContent({ listings, initialSelectedId }: Props) {
  return (
    <AdminReviewShell
      listings={listings}
      initialSelectedId={initialSelectedId}
      renderList={({ items, selectedId, onSelect }) => (
        <AdminReviewListCards items={items} selectedId={selectedId} onSelect={onSelect} />
      )}
    />
  );
}
