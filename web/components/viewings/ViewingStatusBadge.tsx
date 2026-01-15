import { cn } from "@/components/ui/cn";

type Props = {
  status?: string | null;
};

const colorMap: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  declined: "bg-rose-100 text-rose-800 border-rose-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

export function ViewingStatusBadge({ status }: Props) {
  const key = status?.toLowerCase() || "pending";
  const styles = colorMap[key] || colorMap.pending;
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", styles)}>
      {label}
    </span>
  );
}
