"use client";

import { memo } from "react";
import { GlassPill } from "@/components/ui/GlassPill";

type ExploreSectionHeaderProps = {
  section: "market_picks" | "more_to_explore";
  limitedResults?: boolean;
};

const SECTION_LABELS: Record<ExploreSectionHeaderProps["section"], string> = {
  market_picks: "Market picks",
  more_to_explore: "More to explore",
};

export const ExploreSectionHeader = memo(function ExploreSectionHeader({
  section,
  limitedResults = false,
}: ExploreSectionHeaderProps) {
  const label = SECTION_LABELS[section];
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 space-y-1" data-testid="explore-section-header">
      <GlassPill
        variant="dark"
        className="inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90"
      >
        {label}
      </GlassPill>
      {limitedResults ? (
        <p className="text-[11px] font-medium text-white/80" data-testid="explore-limited-results">
          Limited results in this market right now.
        </p>
      ) : null}
    </div>
  );
});
