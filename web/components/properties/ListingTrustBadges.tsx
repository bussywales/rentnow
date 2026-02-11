"use client";

import Link from "next/link";
import { cn } from "@/components/ui/cn";
import type { TrustMarkerState } from "@/lib/trust-markers";
import {
  buildListingTrustBadges,
  type ListingSocialProof,
} from "@/lib/properties/listing-trust-badges";

type Props = {
  createdAt?: string | null;
  trustMarkers?: TrustMarkerState | null;
  socialProof?: ListingSocialProof | null;
  className?: string;
  maxBadges?: number;
};

export function ListingTrustBadges({
  createdAt,
  trustMarkers,
  socialProof,
  className,
  maxBadges = 3,
}: Props) {
  const badges = buildListingTrustBadges({
    markers: trustMarkers,
    createdAt,
    socialProof,
    maxBadges,
  });

  if (!badges.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {badges.map((badge) => {
        const styles =
          badge.key === "verified"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : badge.key === "identity_pending"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : badge.key === "popular"
            ? "border-sky-200 bg-sky-50 text-sky-700"
            : "border-slate-200 bg-slate-50 text-slate-600";
        const title = badge.key === "verified" ? "Verified advertiser" : undefined;
        return (
          <span
            key={badge.key}
            title={title}
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
              styles
            )}
          >
            {badge.label}
          </span>
        );
      })}
      {badges.some((badge) => badge.key === "verified") && (
        <details className="relative">
          <summary
            className="cursor-pointer list-none rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
            title="What does Verified mean?"
          >
            ?
          </summary>
          <div className="absolute left-0 top-7 z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
            <p className="font-semibold text-slate-900">What does Verified mean?</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Advertiser identity checks passed based on platform verification fields.</li>
              <li>Verification status can change if documents or checks expire.</li>
              <li>Always verify details directly before payment decisions.</li>
            </ul>
            <Link href="/help/trust" className="mt-2 inline-flex font-semibold text-sky-700 underline">
              Learn more
            </Link>
          </div>
        </details>
      )}
    </div>
  );
}
