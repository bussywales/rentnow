"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { GlassPill } from "@/components/ui/GlassPill";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { TrackViewedLink } from "@/components/viewed/TrackViewedLink";
import { performShare } from "@/lib/share/client-share";
import { formatLocationLabel } from "@/lib/property-discovery";
import type { Property } from "@/lib/types";
import { ExploreGallery } from "@/components/explore/ExploreGallery";
import { ExploreDetailsSheet } from "@/components/explore/ExploreDetailsSheet";
import { hasSeenExploreDetailsHint, markExploreDetailsHintSeen } from "@/lib/explore/explore-prefs";
import {
  resolveExploreAnalyticsIntentType,
  resolveExploreDetailsHref,
  resolveExploreIntentTag,
  resolveExploreListingKind,
  resolveExploreListingMarketCountry,
  resolveExploreTrustBadges,
} from "@/lib/explore/explore-presentation";

type ExploreSlideProps = {
  property: Property;
  index: number;
  onGestureLockChange?: (locked: boolean) => void;
  onNotInterested?: (listingId: string) => void;
  similarHomes?: Property[];
  onSelectSimilarHome?: (listingId: string) => boolean;
  onOpenDetails?: (input: {
    listingId: string;
    index: number;
    intentType: "shortlet" | "rent" | "buy";
  }) => void;
  onPrimaryActionTap?: (input: {
    listingId: string;
    index: number;
    action: "Book" | "Request viewing";
    intentType: "shortlet" | "rent" | "buy";
  }) => void;
  onSaveToggle?: (input: {
    listingId: string;
    index: number;
    saved: boolean;
    intentType: "shortlet" | "rent" | "buy";
  }) => void;
  onShareAction?: (input: {
    listingId: string;
    index: number;
    result: "shared" | "copied" | "dismissed" | "error";
    intentType: "shortlet" | "rent" | "buy";
  }) => void;
  feedSize?: number;
};

type ExploreSlideActionStackProps = {
  property: Property;
  kind: "shortlet" | "property";
  detailsHref: string;
  location: string;
  intentTag: string;
  marketCountry: string;
  onSave: (saved: boolean) => void;
  onShare: () => void;
  onOpenDetails: () => void;
};

const ExploreSlideActionStack = memo(function ExploreSlideActionStack({
  property,
  kind,
  detailsHref,
  location,
  intentTag,
  marketCountry,
  onSave,
  onShare,
  onOpenDetails,
}: ExploreSlideActionStackProps) {
  return (
    <div className="absolute right-3 top-16 z-20 flex flex-col gap-1.5">
      <GlassPill variant="dark" className="h-11 w-11 p-0.5">
        <SaveToggle
          itemId={property.id}
          kind={kind}
          href={detailsHref}
          title={property.title}
          subtitle={location}
          tag={intentTag}
          marketCountry={marketCountry}
          testId={`explore-save-toggle-${property.id}`}
          onToggle={onSave}
          className="h-full w-full border-transparent bg-transparent text-white ring-0 shadow-none transition-transform active:scale-[0.98] hover:bg-white/10 hover:text-white"
        />
      </GlassPill>
      <GlassPill variant="dark" className="h-11 w-11 p-0.5">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex h-full w-full items-center justify-center rounded-full text-base font-semibold text-white transition-transform active:scale-[0.98]"
          aria-label="Share listing"
          data-testid="explore-share-action"
        >
          ↗
        </button>
      </GlassPill>
      <GlassPill variant="dark" className="h-11 w-11 p-0.5">
        <button
          type="button"
          onClick={onOpenDetails}
          className="inline-flex h-full w-full items-center justify-center rounded-full text-base font-semibold text-white transition-transform active:scale-[0.98]"
          aria-label="Open listing details"
          data-testid="explore-open-details"
        >
          ⋯
        </button>
      </GlassPill>
    </div>
  );
});

function ExploreSlideInner({
  property,
  index,
  onGestureLockChange,
  onNotInterested,
  similarHomes = [],
  onSelectSimilarHome,
  onOpenDetails,
  onPrimaryActionTap,
  onSaveToggle,
  onShareAction,
  feedSize = 0,
}: ExploreSlideProps) {
  const { market } = useMarketPreference();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"copied" | "error" | null>(null);
  const [showDetailsHint, setShowDetailsHint] = useState(false);

  const kind = resolveExploreListingKind(property);
  const intentType = resolveExploreAnalyticsIntentType(property);
  const detailsHref = resolveExploreDetailsHref(property);
  const location = formatLocationLabel(property.city, property.neighbourhood);
  const intentTag = resolveExploreIntentTag(property);
  const badges = resolveExploreTrustBadges(property);
  const listingMarketCountry = resolveExploreListingMarketCountry(property, market.country);
  const shouldLogPerf =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    Boolean((window as Window & { __EXPLORE_PERF_DEBUG__?: boolean }).__EXPLORE_PERF_DEBUG__);

  if (shouldLogPerf) {
    console.count(`[perf][explore-slide] render:${property.id}`);
  }

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setShowDetailsHint(!hasSeenExploreDetailsHint());
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const dismissDetailsHint = useCallback(() => {
    setShowDetailsHint((current) => {
      if (!current) return current;
      markExploreDetailsHintSeen();
      return false;
    });
  }, []);

  const share = useCallback(async () => {
    const absoluteUrl =
      typeof window === "undefined" ? detailsHref : new URL(detailsHref, window.location.origin).toString();
    const result = await performShare({
      title: property.title,
      text: location,
      url: absoluteUrl,
    });
    if (result === "shared" || result === "copied") {
      onShareAction?.({ listingId: property.id, index, result, intentType });
      setShareFeedback("copied");
      return;
    }
    if (result === "dismissed") {
      onShareAction?.({ listingId: property.id, index, result, intentType });
      setShareFeedback(null);
      return;
    }
    onShareAction?.({ listingId: property.id, index, result: "error", intentType });
    setShareFeedback("error");
  }, [detailsHref, index, intentType, location, onShareAction, property.id, property.title]);

  const handleLongPress = useCallback(() => {
    dismissDetailsHint();
    onNotInterested?.(property.id);
  }, [dismissDetailsHint, onNotInterested, property.id]);

  const handleSaveToggle = useCallback((saved: boolean) => {
    onSaveToggle?.({ listingId: property.id, index, saved, intentType });
  }, [index, intentType, onSaveToggle, property.id]);

  const handleShareTap = useCallback(() => {
    void share();
  }, [share]);

  const handleOpenDetails = useCallback(() => {
    dismissDetailsHint();
    onOpenDetails?.({ listingId: property.id, index, intentType });
    setDetailsOpen(true);
  }, [dismissDetailsHint, index, intentType, onOpenDetails, property.id]);

  return (
    <article
      className="relative h-[100svh] w-full snap-start snap-always overflow-hidden bg-slate-950 text-white"
      data-testid="explore-slide"
      onPointerDownCapture={dismissDetailsHint}
    >
      <ExploreGallery
        property={property}
        prioritizeFirstImage={index === 0}
        onGestureLockChange={onGestureLockChange}
        onLongPress={handleLongPress}
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
          <TrustBadges badges={badges} marketCountry={listingMarketCountry} tone="overlay" />
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

      <ExploreSlideActionStack
        property={property}
        kind={kind}
        detailsHref={detailsHref}
        location={location}
        intentTag={intentTag}
        marketCountry={market.country}
        onSave={handleSaveToggle}
        onShare={handleShareTap}
        onOpenDetails={handleOpenDetails}
      />

      {shareFeedback ? (
        <p
          className="absolute right-4 top-56 z-20 rounded-full border border-white/30 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-white"
          data-testid="explore-share-feedback"
          aria-live="polite"
        >
          {shareFeedback === "copied" ? "Link copied" : "Share unavailable"}
        </p>
      ) : null}

      {showDetailsHint ? (
        <p
          className="pointer-events-none absolute left-1/2 top-[44%] z-20 -translate-x-1/2 rounded-full border border-white/30 bg-slate-900/55 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/95 backdrop-blur"
          data-testid="explore-details-hint"
          aria-live="polite"
        >
          Tap for details
        </p>
      ) : null}

      <ExploreDetailsSheet
        open={detailsOpen}
        onOpenChange={(nextOpen) => {
          setDetailsOpen(nextOpen);
          if (nextOpen) dismissDetailsHint();
        }}
        property={property}
        similarHomes={similarHomes}
        onSelectSimilarHome={onSelectSimilarHome}
        onPrimaryActionTap={(action) => {
          onPrimaryActionTap?.({
            listingId: property.id,
            index,
            action,
            intentType,
          });
        }}
        listingIndex={index}
        feedSize={feedSize}
      />
    </article>
  );
}

function areExploreSlidePropsEqual(prev: ExploreSlideProps, next: ExploreSlideProps): boolean {
  return (
    prev.property === next.property &&
    prev.index === next.index &&
    prev.feedSize === next.feedSize &&
    prev.similarHomes === next.similarHomes &&
    prev.onGestureLockChange === next.onGestureLockChange &&
    prev.onNotInterested === next.onNotInterested &&
    prev.onSelectSimilarHome === next.onSelectSimilarHome &&
    prev.onOpenDetails === next.onOpenDetails &&
    prev.onPrimaryActionTap === next.onPrimaryActionTap &&
    prev.onSaveToggle === next.onSaveToggle &&
    prev.onShareAction === next.onShareAction
  );
}

export const ExploreSlide = memo(ExploreSlideInner, areExploreSlidePropsEqual);
