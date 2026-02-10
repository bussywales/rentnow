"use client";

import { cn } from "@/components/ui/cn";

type Props = {
  tier: string;
  className?: string;
  "data-testid"?: string;
};

function normalizeTier(tier: string): string {
  return String(tier || "Bronze").trim().toLowerCase();
}

function tierStyles(tier: string): string {
  const normalized = normalizeTier(tier);
  if (normalized === "silver") return "bg-slate-200 text-slate-800";
  if (normalized === "gold") return "bg-amber-100 text-amber-800";
  if (normalized === "platinum") return "bg-cyan-100 text-cyan-800";
  return "bg-orange-100 text-orange-800";
}

export default function ReferralTierBadge(props: Props) {
  return (
    <span
      title="Tier is based on your number of Active referrals."
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        tierStyles(props.tier),
        props.className
      )}
      data-testid={props["data-testid"]}
    >
      <span aria-hidden>●</span>
      {props.tier}
    </span>
  );
}
