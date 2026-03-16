import { getPropertyRequestStatusLabel, type PropertyRequestStatus } from "@/lib/requests/property-requests";

const statusStyles: Record<PropertyRequestStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-700",
  matched: "bg-sky-100 text-sky-700",
  closed: "bg-amber-100 text-amber-700",
  expired: "bg-rose-100 text-rose-700",
  removed: "bg-slate-200 text-slate-600",
};

export function PropertyRequestStatusBadge({ status }: { status: PropertyRequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusStyles[status]}`}
      data-testid={`property-request-status-${status}`}
    >
      {getPropertyRequestStatusLabel(status)}
    </span>
  );
}
