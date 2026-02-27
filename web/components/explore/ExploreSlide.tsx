"use client";

import { useState } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { TrackViewedLink } from "@/components/viewed/TrackViewedLink";
import { performShare } from "@/lib/share/client-share";
import { formatLocationLabel } from "@/lib/property-discovery";
import type { Property } from "@/lib/types";
import { ExploreGallery } from "@/components/explore/ExploreGallery";
import { ExploreDetailsSheet } from "@/components/explore/ExploreDetailsSheet";
import {
  resolveExploreDetailsHref,
  resolveExploreIntentTag,
  resolveExploreListingKind,
  resolveExploreTrustBadges,
} from "@/lib/explore/explore-presentation";

type ExploreSlideProps = {
  property: Property;
  index: number;
  onGestureLockChange?: (locked: boolean) => void;
};

export function ExploreSlide({ property, index, onGestureLockChange }: ExploreSlideProps) {
  const { market } = useMarketPreference();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"copied" | "error" | null>(null);

  const kind = resolveExploreListingKind(property);
  const detailsHref = resolveExploreDetailsHref(property);
  const location = formatLocationLabel(property.city, property.neighbourhood);
  const intentTag = resolveExploreIntentTag(property);
  const badges = resolveExploreTrustBadges(property);

  const share = async () => {
    const absoluteUrl =
      typeof window === "undefined" ? detailsHref : new URL(detailsHref, window.location.origin).toString();
    const result = await performShare({
      title: property.title,
      text: location,
      url: absoluteUrl,
    });
    if (result === "shared" || result === "copied") {
      setShareFeedback("copied");
      return;
    }
    if (result === "dismissed") {
      setShareFeedback(null);
      return;
    }
    setShareFeedback("error");
  };

  return (
    <article
      className="relative h-[100svh] w-full snap-start snap-always overflow-hidden bg-slate-950 text-white"
      data-testid="explore-slide"
    >
      <ExploreGallery
        property={property}
        prioritizeFirstImage={index === 0}
        onGestureLockChange={onGestureLockChange}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/20 to-transparent"
        aria-hidden
      />

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-6">
        <div className="max-w-[82%] space-y-2">
          <span className="inline-flex rounded-full border border-white/35 bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/95">
            {intentTag}
          </span>
          <TrustBadges badges={badges} marketCountry={market.country} tone="overlay" />
          <h2 className="line-clamp-2 text-[1.65rem] font-semibold leading-[1.15]">{property.title}</h2>
          <p className="line-clamp-1 text-sm text-white/90">{location}</p>
          <TrackViewedLink
            href={detailsHref}
            viewedItem={{
              id: property.id,
              kind,
              href: detailsHref,
              title: property.title,
              subtitle: location,
              tag: intentTag,
              marketCountry: market.country,
            }}
            className="inline-flex rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/95 backdrop-blur"
            data-testid="explore-view-details"
          >
            View full details
          </TrackViewedLink>
        </div>
      </div>

      <div className="absolute right-3 top-16 z-20 flex flex-col gap-1.5">
        <SaveToggle
          itemId={property.id}
          kind={kind}
          href={detailsHref}
          title={property.title}
          subtitle={location}
          tag={intentTag}
          marketCountry={market.country}
          testId={`explore-save-toggle-${property.id}`}
          className="h-9 w-9 border-white/25 bg-slate-900/40 text-white ring-0 shadow-sm backdrop-blur transition active:scale-95 hover:bg-slate-900/55"
        />
        <button
          type="button"
          onClick={() => {
            void share();
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-slate-900/40 text-base font-semibold text-white shadow-sm backdrop-blur transition active:scale-95 hover:bg-slate-900/55"
          aria-label="Share listing"
          data-testid="explore-share-action"
        >
          ↗
        </button>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-slate-900/40 text-base font-semibold text-white shadow-sm backdrop-blur transition active:scale-95 hover:bg-slate-900/55"
          aria-label="Open listing details"
          data-testid="explore-open-details"
        >
          ⋯
        </button>
      </div>

      {shareFeedback ? (
        <p
          className="absolute right-4 top-56 z-20 rounded-full border border-white/30 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-white"
          data-testid="explore-share-feedback"
          aria-live="polite"
        >
          {shareFeedback === "copied" ? "Link copied" : "Share unavailable"}
        </p>
      ) : null}

      <ExploreDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} property={property} />
    </article>
  );
}
