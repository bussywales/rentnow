"use client";

import { useMemo } from "react";

type PerformanceSnapshot = {
  views: number;
  enquiries: number;
};

type Props = {
  missingFlags: string[];
  performance?: PerformanceSnapshot | null;
};

const NUDGE_MAP: Array<{
  key: string;
  flags: string[];
  label: string;
}> = [
  {
    key: "photos",
    flags: ["no_photos", "few_photos"],
    label: "Add 6+ photos to boost trust and clicks.",
  },
  {
    key: "price",
    flags: ["no_price"],
    label: "Add a price to help serious enquiries qualify faster.",
  },
  {
    key: "description",
    flags: ["no_description", "short_description"],
    label: "Expand the description with key features and nearby highlights.",
  },
  {
    key: "location",
    flags: ["no_location"],
    label: "Add a clearer location for better search placement.",
  },
  {
    key: "title",
    flags: ["short_title"],
    label: "Make the title more specific (beds, area, key feature).",
  },
  {
    key: "intent",
    flags: ["no_intent"],
    label: "Select whether this is for rent/lease or for sale.",
  },
];

export function ListingNudges({ missingFlags, performance }: Props) {
  const items = useMemo(() => {
    if (!missingFlags.length) return [];
    const selected = NUDGE_MAP.filter((nudge) =>
      nudge.flags.some((flag) => missingFlags.includes(flag))
    );
    return selected.slice(0, 5);
  }, [missingFlags]);

  if (!items.length && !performance) return null;

  const performanceHint =
    performance && performance.views > 0 && performance.enquiries === 0
      ? `You have ${performance.views} views but no enquiries—try updating photos and price.`
      : null;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid="listing-nudges"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Improve your listing</h3>
          <p className="text-xs text-slate-500">Quick fixes that can lift engagement.</p>
        </div>
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        {items.map((item) => (
          <div key={item.key} className="flex items-start gap-2" data-testid="listing-nudge-item">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-900" />
            <span>{item.label}</span>
          </div>
        ))}
        {performanceHint ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-600" />
            <span>{performanceHint}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
