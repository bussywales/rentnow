import { ViewingStatusBadge } from "@/components/viewings/ViewingStatusBadge";

export type ViewingRequestItem = {
  id: string;
  status: string;
  preferred_times: string[];
  message: string | null;
  created_at: string;
  properties?: { title?: string | null; city?: string | null; neighbourhood?: string | null } | null;
};

type Props = { request: ViewingRequestItem };

function formatTimes(times: string[]): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
      data-testid="viewing-row"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {location && <p className="text-sm text-slate-600">{location}</p>}
        <p className="text-sm text-slate-700">
          Preferred: {formatTimes(request.preferred_times || [])}
        </p>
        <p className="text-xs text-slate-500">
          Requested {formatRequestedAt(request.created_at)}
        </p>
        {request.message && (
          <p className="text-sm text-slate-600">Note: {request.message}</p>
        )}
      </div>
      <ViewingStatusBadge status={request.status} />
    </div>
  );
}
