import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import { mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

type Props = {
  listings: DashboardListing[];
};

function statusChipClass(status: string | null) {
  switch (normalizePropertyStatus(status)) {
    case "live":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "expired":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "paused":
    case "paused_owner":
    case "paused_occupied":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function listingLocationText(listing: DashboardListing) {
  return listing.location_label || listing.city || listing.admin_area_1 || "Location not set";
}

export function HostListingsRail({ listings }: Props) {
  if (listings.length === 0) {
    return (
      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="host-home-listings-rail"
      >
        <p className="text-sm font-semibold text-slate-900">My listings</p>
        <p className="mt-1 text-sm text-slate-600">
          Publish your first listing to unlock the media feed.
        </p>
      </section>
    );
  }

  return (
    <section
      className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      data-testid="host-home-listings-rail"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            My listings
          </p>
          <h2 className="text-lg font-semibold text-slate-900">Your media feed</h2>
        </div>
        <Link
          href="/dashboard/properties"
          className="text-xs font-semibold text-sky-700 hover:text-sky-800"
        >
          Manage all
        </Link>
      </div>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {listings.map((listing) => {
          const imageUrl = getPrimaryImageUrl(listing);
          return (
            <article
              key={listing.id}
              className="w-[288px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white md:w-[312px]"
              data-testid={`host-home-listings-rail-card-${listing.id}`}
            >
              <div className="relative h-44 w-full bg-slate-100">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={listing.title}
                    fill
                    sizes="(max-width: 768px) 88vw, 320px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
                )}
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusChipClass(
                      listing.status ?? null
                    )}`}
                  >
                    {mapStatusLabel(listing.status)}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Score {listing.readiness.score}
                  </span>
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{listing.title}</h3>
                <p className="line-clamp-1 text-xs text-slate-500">{listingLocationText(listing)}</p>
                <Link href={`/dashboard/properties/${listing.id}`} className="inline-flex">
                  <Button size="sm" variant="secondary">
                    Open listing
                  </Button>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
