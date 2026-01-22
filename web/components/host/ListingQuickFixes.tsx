import Link from "next/link";
import type { ReadinessResult } from "@/lib/properties/listing-readiness";
import { buildEditorUrl } from "@/lib/properties/host-dashboard";

type Props = {
  readiness: ReadinessResult;
  propertyId: string;
};

const LABELS: Record<string, string> = {
  NO_PHOTOS: "Add photos",
  LOW_PHOTO_COUNT: "Add more photos",
  NO_COVER: "Set cover",
  WEAK_COVER: "Improve cover",
  RECOMMENDED_COVER: "Use recommended cover",
  LOCATION_WEAK: "Pin area",
  LOCATION_MEDIUM: "Improve location",
};

const hrefForIssue = (code: string, propertyId: string) => {
  if (code === "LOCATION_WEAK" || code === "LOCATION_MEDIUM") {
    return buildEditorUrl(propertyId, "LOCATION_WEAK");
  }
  return buildEditorUrl(propertyId, undefined, { step: "photos" });
};

export function ListingQuickFixes({ readiness, propertyId }: Props) {
  const actionable = readiness.issues.slice(0, 2);
  if (!actionable.length) return null;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <p className="font-semibold text-slate-900">Quick fixes</p>
      <div className="flex flex-wrap gap-2">
        {actionable.map((issue) => {
          const label = LABELS[issue.code] || "Improve";
          const href = hrefForIssue(issue.code, propertyId);
          return (
            <Link
              key={issue.key}
              href={href}
              className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
