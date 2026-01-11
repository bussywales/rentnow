"use client";

import { buildTrustBadges, type TrustMarkerState } from "@/lib/trust-markers";
import { cn } from "@/components/ui/cn";

type Props = {
  markers?: TrustMarkerState | null;
  compact?: boolean;
};

export function TrustBadges({ markers, compact }: Props) {
  const badges = buildTrustBadges(markers);
  if (!badges.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "text-[11px]" : "text-xs")}>
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={cn(
            "rounded-full px-3 py-1 font-semibold",
            badge.verified
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
