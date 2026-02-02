import { cn } from "@/components/ui/cn";

type Tone = "slate" | "emerald" | "amber" | "rose" | "sky";

const toneMap: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
};

type Props = {
  label: string;
  tone?: Tone;
  className?: string;
};

export function AdminUserBadge({ label, tone = "slate", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        toneMap[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
