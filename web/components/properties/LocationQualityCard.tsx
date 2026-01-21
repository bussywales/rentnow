import { Button } from "@/components/ui/Button";
import InfoPopover from "@/components/ui/InfoPopover";
import type { LocationQuality } from "@/lib/properties/location-quality";
import clsx from "clsx";

type Props = {
  quality: LocationQuality;
  missing: string[];
  onImproveLocation: () => void;
  className?: string;
};

const QUALITY_LABEL: Record<LocationQuality, string> = {
  strong: "Looks good",
  medium: "Could be clearer",
  weak: "Needs attention",
};

const QUALITY_DESC: Record<LocationQuality, string> = {
  strong: "Your area info is detailed enough for reliable search and map placement.",
  medium: "Add one more detail (like county/LGA or postcode) to improve search accuracy.",
  weak: "Pin an area first so we can place your listing on the map and in nearby searches.",
};

export function LocationQualityCard({ quality, missing, onImproveLocation, className }: Props) {
  const isWeak = quality === "weak";
  const isMedium = quality === "medium";
  const badgeClass = clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", {
    "bg-emerald-100 text-emerald-800": quality === "strong",
    "bg-amber-100 text-amber-800": isMedium,
    "bg-rose-100 text-rose-800": isWeak,
  });

  return (
    <div className={clsx("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Location quality</p>
          <p className="text-xs text-slate-600">
            Helps your listing appear in the right searches. This won’t show an exact address to guests.
          </p>
        </div>
        <span className={badgeClass}>{QUALITY_LABEL[quality]}</span>
      </div>
      <p className="mt-3 text-sm text-slate-700">{QUALITY_DESC[quality]}</p>
      {missing.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onImproveLocation}>
          Improve location
        </Button>
        <InfoPopover
          ariaLabel="Why location quality matters"
          title="Why this matters"
          bullets={[
            "Pinned areas and region details help us place your listing in the right searches. Guests see an approximate area—not your exact address.",
          ]}
        />
      </div>
    </div>
  );
}
