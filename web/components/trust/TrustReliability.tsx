"use client";

import { buildReliabilityItems, type TrustMarkerState } from "@/lib/trust-markers";

type Props = {
  markers?: TrustMarkerState | null;
};

export function TrustReliability({ markers }: Props) {
  const items = buildReliabilityItems(markers);
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
      {items.map((item) => (
        <span
          key={item.key}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700"
        >
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}
