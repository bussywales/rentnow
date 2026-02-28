"use client";

import { cn } from "@/components/ui/cn";
import type { ExploreTrustBadge } from "@/lib/explore/explore-presentation";

type ExploreTrustBadgesProps = {
  badges?: ReadonlyArray<ExploreTrustBadge> | null;
  tone?: "overlay" | "surface";
  className?: string;
};

export function ExploreTrustBadges({ badges, tone = "surface", className }: ExploreTrustBadgesProps) {
  const safeBadges = (badges ?? []).filter(Boolean);
  if (!safeBadges.length) return null;

  const toneClass =
    tone === "overlay"
      ? "border-white/35 bg-slate-900/55 text-white/95"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} data-testid="explore-trust-badges">
      {safeBadges.map((badge) => (
        <span
          key={badge.key}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
            toneClass
          )}
          data-testid="explore-trust-badge"
          data-badge={badge.key}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
