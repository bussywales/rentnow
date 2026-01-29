"use client";

import { AdminReviewDesk } from "@/components/admin/AdminReviewDesk";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  listings: AdminReviewListItem[];
  initialSelectedId: string | null;
};

export default function AdminReviewPanelContent({ listings, initialSelectedId }: Props) {
  return (
    <AdminReviewDesk
      listings={listings}
      initialSelectedId={initialSelectedId}
      allowedViews={["pending", "changes", "all"]}
      viewLabels={{ all: "All reviewable" }}
      showBulkSelect
      bulkFormId="bulk-approvals"
      actionsEnabled
    />
  );
}
