import { cn } from "@/components/ui/cn";

type Props = {
  status?: string | null;
};

const colorMap: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800 border-amber-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  proposed: "bg-sky-100 text-sky-800 border-sky-200",
  declined: "bg-rose-100 text-rose-800 border-rose-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  no_show: "bg-orange-100 text-orange-800 border-orange-200",
};

const labelMap: Record<string, string> = {
  requested: "Requested",
  approved: "Confirmed",
  proposed: "New times suggested",
  declined: "Not available",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show recorded",
};

export function ViewingStatusBadge({ status }: Props) {
  const key = status?.toLowerCase() || "requested";
  const styles = colorMap[key] || colorMap.pending;
  const label = labelMap[key] || labelMap.requested;
  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", styles)}>
      {label}
    </span>
  );
}
