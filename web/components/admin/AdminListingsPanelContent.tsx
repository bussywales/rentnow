"use client";

import { useRouter } from "next/navigation";
import { AdminListingsTable } from "@/components/admin/AdminListingsTable";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  listings: AdminReviewListItem[];
};

export default function AdminListingsPanelContent({ listings }: Props) {
  const router = useRouter();
  return (
    <AdminListingsTable
      items={listings}
      onSelect={(id) => router.push(`/admin/listings/${encodeURIComponent(id)}`)}
    />
  );
}
