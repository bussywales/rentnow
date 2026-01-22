import { HOST_DASHBOARD_COPY } from "@/lib/host/host-dashboard-microcopy";
import type { DashboardListing } from "@/lib/properties/host-dashboard";
import { buildEditorUrl, getLastUpdatedDate } from "@/lib/properties/host-dashboard";

const ISSUE_LABELS: Record<string, string> = {
  NO_PHOTOS: "Add photos",
  LOW_PHOTO_COUNT: "Add more photos",
  NO_COVER: "Set cover",
  WEAK_COVER: "Improve cover",
  RECOMMENDED_COVER: "Use recommended cover",
  LOCATION_WEAK: "Pin area",
  LOCATION_MEDIUM: "Improve location",
};

export function buildEditorLink(listing: DashboardListing): string {
  const topIssue = listing.readiness.issues[0]?.code;
  return buildEditorUrl(listing.id, topIssue);
}

export function topIssueLabel(listing: DashboardListing): string {
  const topIssue = listing.readiness.issues[0];
  if (!topIssue) return "None";
  return ISSUE_LABELS[topIssue.code] || topIssue.label || topIssue.code;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export function toCsv(listings: DashboardListing[]): string {
  const header = [
    "listing_id",
    "title",
    "status",
    "readiness_score",
    "readiness_tier",
    "top_issue_code",
    "top_issue_label",
    "last_updated_iso",
  ];
  const rows = listings.map((listing) => {
    const topIssue = listing.readiness.issues[0];
    const values = [
      listing.id || "",
      listing.title || "",
      listing.status || (listing.is_active ? "live" : "draft") || "",
      listing.readiness.score.toString(),
      listing.readiness.tier,
      topIssue?.code ?? "",
      topIssue?.label ?? "",
      getLastUpdatedDate(listing) ?? "",
    ];
    return values.map(escapeCsv).join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export function exportListingsCsv(listings: DashboardListing[]) {
  const csv = toCsv(listings);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute("download", `listings-triage-${date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatBulkSelected(count: number): string {
  return HOST_DASHBOARD_COPY.bulkBar.selected.replace("{count}", String(count));
}
