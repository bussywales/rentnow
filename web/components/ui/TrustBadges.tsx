import { cn } from "@/components/ui/cn";
import {
  resolveMarketPicksLabel,
  type DiscoveryTrustBadge,
} from "@/lib/discovery";

type TrustBadgesProps = {
  badges?: ReadonlyArray<DiscoveryTrustBadge> | null;
  marketCountry?: string | null;
  tone?: "surface" | "overlay";
  className?: string;
};

const BADGE_LABELS: Record<DiscoveryTrustBadge, string> = {
  VERIFIED: "Verified",
  POPULAR: "Popular",
  NEW: "New",
};

const BADGE_STYLES_SURFACE: Record<DiscoveryTrustBadge, string> = {
  VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  POPULAR: "border-sky-200 bg-sky-50 text-sky-700",
  NEW: "border-amber-200 bg-amber-50 text-amber-700",
};

const BADGE_STYLES_OVERLAY: Record<DiscoveryTrustBadge, string> = {
  VERIFIED: "border-emerald-200/80 bg-emerald-100/90 text-emerald-900",
  POPULAR: "border-sky-200/80 bg-sky-100/90 text-sky-900",
  NEW: "border-amber-200/80 bg-amber-100/90 text-amber-900",
};

export function TrustBadges({
  badges,
  marketCountry,
  tone = "surface",
  className,
}: TrustBadgesProps) {
  const safeBadges = Array.from(new Set((badges ?? []).filter(Boolean)));
  const marketLabel = marketCountry ? resolveMarketPicksLabel(marketCountry) : null;
  const marketPicksClass =
    tone === "overlay"
      ? "border-white/30 bg-white/15 text-white/90"
      : "border-slate-200 bg-slate-100 text-slate-600";
  const badgeStyles = tone === "overlay" ? BADGE_STYLES_OVERLAY : BADGE_STYLES_SURFACE;

  if (!safeBadges.length && !marketLabel) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} data-testid="trust-badges">
      {marketLabel ? (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
            marketPicksClass
          )}
          data-testid="trust-market-picks"
        >
          {marketLabel}
        </span>
      ) : null}
      {safeBadges.map((badge) => (
        <span
          key={badge}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
            badgeStyles[badge]
          )}
          data-testid="trust-badge"
          data-badge={badge}
        >
          {BADGE_LABELS[badge]}
        </span>
      ))}
    </div>
  );
}
