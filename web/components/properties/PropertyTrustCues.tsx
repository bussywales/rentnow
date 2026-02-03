"use client";

import { cn } from "@/components/ui/cn";
import { buildTrustCues } from "@/lib/trust-cues";
import type { TrustMarkerState } from "@/lib/trust-markers";

type Props = {
  markers?: TrustMarkerState | null;
  fastResponder?: boolean;
  createdAt?: string | null;
  className?: string;
};

export function PropertyTrustCues({
  markers,
  fastResponder,
  createdAt,
  className,
}: Props) {
  const cues = buildTrustCues({ markers, fastResponder, createdAt });
  if (!cues.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)} data-testid="trust-cues">
      {cues.map((cue) => (
        <span
          key={cue.key}
          className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
        >
          {cue.label}
        </span>
      ))}
    </div>
  );
}
