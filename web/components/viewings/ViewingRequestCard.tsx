import { ViewingStatusBadge } from "@/components/viewings/ViewingStatusBadge";

export type ViewingRequestItem = {
  id: string;
  status: string;
  preferred_times: string[];
  approved_time?: string | null;
  proposed_times?: string[] | null;
  host_message?: string | null;
  decline_reason_code?: string | null;
  decided_at?: string | null;
  no_show_reported_at?: string | null;
  message: string | null;
  created_at: string;
  properties?:
    | { title?: string | null; city?: string | null; neighbourhood?: string | null; timezone?: string | null }
    | null;
};

type Props = { request: ViewingRequestItem };

function formatTimes(times: string[], timeZone?: string | null): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone || undefined,
  });
  return times.map((t) => formatter.format(new Date(t))).join(" • ");
}

function formatRequestedAt(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const diff = d.getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (Math.abs(days) <= 3) {
    return formatter.format(days, "day");
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ViewingRequestCard({ request }: Props) {
  const title = request.properties?.title || "Home";
  const location = [request.properties?.city, request.properties?.neighbourhood]
    .filter(Boolean)
    .join(" • ");
  const tz = request.properties?.timezone;

  const reasonMap: Record<string, string> = {
    schedule_conflict: "Scheduling conflict",
    property_unavailable: "Property unavailable at that time",
    maintenance: "Maintenance or access issues",
    already_booked: "Time already booked",
    incomplete_request: "Request needs more details",
    other: "Unable to accommodate at this time",
  };

  const badgeStatus = request.no_show_reported_at ? "no_show" : request.status;
  const statusDetail =
    badgeStatus === "approved" || badgeStatus === "confirmed"
      ? request.approved_time
        ? `Viewing confirmed: ${formatTimes([request.approved_time], tz)}`
        : null
      : badgeStatus === "proposed" && request.proposed_times?.length
        ? `New times suggested: ${formatTimes(request.proposed_times, tz)}`
        : badgeStatus === "declined"
          ? request.decline_reason_code
            ? `Not available. Reason: ${reasonMap[request.decline_reason_code] || request.decline_reason_code}`
            : "This viewing couldn't be scheduled."
          : badgeStatus === "cancelled"
            ? "This viewing request was cancelled."
            : badgeStatus === "completed"
              ? "This viewing has taken place."
              : badgeStatus === "no_show"
                ? "Marked as no-show by host."
                : "Waiting for the host to review your request.";

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
      data-testid="viewing-row"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {location && <p className="text-sm text-slate-600">{location}</p>}
        <p className="text-sm text-slate-700">
          Preferred: {formatTimes(request.preferred_times || [], tz)}
        </p>
        {request.no_show_reported_at && (
          <p className="text-sm text-slate-700">Marked as no-show by host.</p>
        )}
        <p className="text-xs text-slate-500">
          Requested {formatRequestedAt(request.created_at)}
        </p>
        {statusDetail && <p className="text-sm text-slate-700">{statusDetail}</p>}
        {request.message && (
          <p className="text-sm text-slate-600">Note: {request.message}</p>
        )}
        {request.host_message && (
          <p className="text-sm text-slate-700">Host note: {request.host_message}</p>
        )}
      </div>
      <ViewingStatusBadge status={badgeStatus} />
    </div>
  );
}
