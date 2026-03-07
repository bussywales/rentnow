"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ExploreV2ConversionSheet } from "@/components/explore-v2/ExploreV2ConversionSheet";
import { GlassTooltip, shouldEnableGlassTooltip } from "@/components/ui/GlassTooltip";
import { cn } from "@/components/ui/cn";
import {
  UnifiedImageCarousel,
  type UnifiedImageCarouselItem,
} from "@/components/ui/UnifiedImageCarousel";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { trackExploreFunnelEvent, type ExploreFunnelIntent } from "@/lib/explore/explore-funnel";
import { performShare, type ShareActionResult } from "@/lib/share/client-share";
import type { Property } from "@/lib/types";
import {
  resolveExploreAnalyticsIntentType,
  resolveExploreDetailsHref,
  resolveExploreIntentTag,
  resolveExploreListingKind,
  resolveExploreListingMarketCountry,
  resolveExplorePriceClarityCopy,
  resolveExplorePrimaryAction,
  resolveExplorePriceCopy,
} from "@/lib/explore/explore-presentation";
import {
  EXPLORE_GALLERY_FALLBACK_IMAGE,
  normalizeExploreGalleryImageUrl,
  resolveExploreImagePlaceholderMeta,
  resolveExplorePropertyImageRecords,
} from "@/lib/explore/gallery-images";
import { glassSurface } from "@/lib/ui/glass";
import { formatListingTitle } from "@/lib/ui/format-listing-title";
import { useIsTruncated } from "@/lib/ui/useIsTruncated";

type ExploreV2CardProps = {
  listing: Property;
  marketCurrency: string | null;
  imageRecords?: ExploreImageRecord[];
  index?: number;
  feedSize?: number;
  viewerIsAuthenticated?: boolean;
};

type ExploreImageRecord = ReturnType<typeof resolveExplorePropertyImageRecords>[number];

type ExploreV2ActionContext = {
  listingId: string;
  marketCode: string;
  intentType: ExploreFunnelIntent;
  index: number;
  feedSize: number;
};

type ExploreV2ShareActionInput = {
  detailsHref: string;
  title: string | null | undefined;
  locationLine: string;
  context: ExploreV2ActionContext;
};

type ExploreV2ShareActionDeps = {
  shareFn?: typeof performShare;
  trackFn?: typeof trackExploreFunnelEvent;
  origin?: string | null;
};

type ExploreV2CtaContinueInput = {
  href: string;
  label: "Book" | "Request viewing";
  context: ExploreV2ActionContext;
};

type ExploreV2CtaContinueDeps = {
  pushFn: (href: string) => void;
  trackFn?: typeof trackExploreFunnelEvent;
};

type ExploreV2ViewDetailsInput = {
  href: string;
  context: ExploreV2ActionContext;
};

type ExploreV2ViewDetailsDeps = {
  pushFn: (href: string) => void;
  trackFn?: typeof trackExploreFunnelEvent;
};

export const EXPLORE_V2_QUIET_OVERLAY_FOCUS_MS = 2600;
export const EXPLORE_V2_QUIET_OVERLAY_OPACITY_CLASS = "opacity-[0.85]";
export const EXPLORE_V2_GLASS_TOAST_DISMISS_MS = 2000;
export const EXPLORE_V2_DOCK_SAFE_ZONE_PX = 136;
export const EXPLORE_V2_GLASS_TOAST_BOTTOM_OFFSET_PX = EXPLORE_V2_DOCK_SAFE_ZONE_PX + 12;

type ExploreV2GlassToastTone = "success" | "error";

type ExploreV2GlassToastState = {
  message: string;
  tone: ExploreV2GlassToastTone;
  showRetry: boolean;
} | null;

type ExploreV2OverlayFocusControllerOptions = {
  focusDurationMs?: number;
  onChange: (focused: boolean) => void;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timerId: ReturnType<typeof setTimeout>) => void;
};

function resolveExploreV2LocationLine(listing: Property): string {
  const parts = [listing.city, listing.country_code ?? listing.country]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) return "Location available on details";
  return parts.join(", ");
}

function resolveCreatedAtTimestamp(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return parsed;
}

export function resolveExploreV2HeroUiState(totalImages: number): {
  showSwipeAffordance: boolean;
  showDots: boolean;
  showCountBadge: boolean;
} {
  const showSwipeAffordance = totalImages > 1;
  return {
    showSwipeAffordance,
    showDots: showSwipeAffordance,
    showCountBadge: showSwipeAffordance,
  };
}

export function resolveExploreV2HasVideo(
  listing: Pick<Property, "has_video" | "featured_media">
): boolean {
  if (typeof listing.has_video === "boolean") {
    return listing.has_video;
  }
  return listing.featured_media === "video";
}

export function resolveExploreV2VideoTourHref(detailsHref: string): string {
  if (detailsHref.includes("media=video")) return detailsHref;
  return detailsHref.includes("?") ? `${detailsHref}&media=video` : `${detailsHref}?media=video`;
}

export function resolveExploreV2ActionContext(input: {
  listing: Property;
  index?: number;
  feedSize?: number;
}): ExploreV2ActionContext {
  const marketCode = resolveExploreListingMarketCountry(input.listing, input.listing.country_code ?? null);
  return {
    listingId: input.listing.id,
    marketCode,
    intentType: resolveExploreAnalyticsIntentType(input.listing),
    index: Number.isFinite(input.index) ? Math.max(0, input.index ?? 0) : 0,
    feedSize: Number.isFinite(input.feedSize) ? Math.max(0, input.feedSize ?? 0) : 0,
  };
}

export function trackExploreV2SaveToggle(input: {
  context: ExploreV2ActionContext;
  saved: boolean;
  trackFn?: typeof trackExploreFunnelEvent;
}) {
  const trackFn = input.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_save_toggle",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "save",
    result: input.saved ? "saved" : "unsaved",
  });
}

export function trackExploreV2CtaSheetOpened(input: {
  context: ExploreV2ActionContext;
  label: "Book" | "Request viewing";
  trackFn?: typeof trackExploreFunnelEvent;
}) {
  const trackFn = input.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_cta_sheet_opened",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: input.label.toLowerCase(),
    result: "opened",
  });
}

export function trackExploreV2CtaPrimaryClicked(input: {
  context: ExploreV2ActionContext;
  label: "Book" | "Request viewing";
  trackFn?: typeof trackExploreFunnelEvent;
}) {
  const trackFn = input.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_cta_primary_clicked",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: input.label.toLowerCase(),
    result: "clicked",
  });
}

export function trackExploreV2CtaViewDetailsClicked(input: {
  context: ExploreV2ActionContext;
  trackFn?: typeof trackExploreFunnelEvent;
}) {
  const trackFn = input.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_cta_view_details_clicked",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "view_details",
    result: "clicked",
  });
}

export function trackExploreV2CtaSaveClicked(input: {
  context: ExploreV2ActionContext;
  result: "saved" | "unsaved" | "auth_required";
  trackFn?: typeof trackExploreFunnelEvent;
}) {
  const trackFn = input.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_cta_save_clicked",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "save",
    result: input.result,
  });
}

export function trackExploreV2CtaShareClicked(input: {
  context: ExploreV2ActionContext;
  result: "shared" | "copied" | "dismissed" | "error";
  trackFn?: typeof trackExploreFunnelEvent;
}) {
  const trackFn = input.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_cta_share_clicked",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "share",
    result: input.result,
  });
}

export async function triggerExploreV2ShareAction(
  input: ExploreV2ShareActionInput,
  deps: ExploreV2ShareActionDeps = {}
): Promise<Exclude<ShareActionResult, "unavailable"> | "error"> {
  const shareFn = deps.shareFn ?? performShare;
  const origin =
    deps.origin === undefined
      ? typeof window === "undefined"
        ? null
        : window.location.origin
      : deps.origin;
  const absoluteUrl = origin ? new URL(input.detailsHref, origin).toString() : input.detailsHref;
  const shareResult = await shareFn({
    title: input.title ?? "Explore listing",
    text: input.locationLine,
    url: absoluteUrl,
  });
  const trackFn = deps.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_share",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "share",
    result: shareResult,
  });
  if (shareResult === "unavailable") {
    return "error";
  }
  return shareResult;
}

export function continueExploreV2Cta(
  input: ExploreV2CtaContinueInput,
  deps: ExploreV2CtaContinueDeps
) {
  const trackFn = deps.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_cta_continue",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "continue",
    result: "navigated",
  });
  trackExploreV2CtaPrimaryClicked({
    context: input.context,
    label: input.label,
    trackFn,
  });
  deps.pushFn(input.href);
}

export function continueExploreV2ViewDetails(
  input: ExploreV2ViewDetailsInput,
  deps: ExploreV2ViewDetailsDeps
) {
  const trackFn = deps.trackFn ?? trackExploreFunnelEvent;
  trackExploreV2CtaViewDetailsClicked({
    context: input.context,
    trackFn,
  });
  deps.pushFn(input.href);
}

export function resolveExploreV2OverlayOpacityClass(overlayFocused: boolean): string {
  return overlayFocused ? "opacity-100" : EXPLORE_V2_QUIET_OVERLAY_OPACITY_CLASS;
}

export function resolveExploreV2SaveFeedbackMessage(saved: boolean): string {
  return saved ? "Saved" : "Removed";
}

export function shouldShowExploreV2TitleTooltip(input: {
  title: string | null | undefined;
  isTruncated: boolean;
}): boolean {
  return shouldEnableGlassTooltip({
    content: input.title ?? "",
    isTruncated: input.isTruncated,
  });
}

export function resolveExploreV2ShareFeedback(input: ShareActionResult | "error"): ExploreV2GlassToastState {
  if (input === "shared") {
    return { message: "Shared", tone: "success", showRetry: false };
  }
  if (input === "copied") {
    return { message: "Link copied", tone: "success", showRetry: false };
  }
  if (input === "dismissed") {
    return null;
  }
  return { message: "Copy failed", tone: "error", showRetry: true };
}

export function resolveExploreV2GlassToastBottom(): string {
  return `calc(${EXPLORE_V2_GLASS_TOAST_BOTTOM_OFFSET_PX}px + env(safe-area-inset-bottom))`;
}

export function resolveExploreV2GlassToastClassName(tone: ExploreV2GlassToastTone): string {
  return cn(
    glassSurface(
      "pointer-events-auto inline-flex min-h-[42px] max-w-[88vw] items-center gap-2 rounded-[999px] px-4 py-2 text-xs font-medium text-white"
    ),
    tone === "error"
      ? "border-rose-200/30 bg-rose-900/45 text-rose-50"
      : "border-white/18 bg-slate-900/48 text-white"
  );
}

export function createExploreV2OverlayFocusController({
  focusDurationMs = EXPLORE_V2_QUIET_OVERLAY_FOCUS_MS,
  onChange,
  setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer = (timerId) => clearTimeout(timerId),
}: ExploreV2OverlayFocusControllerOptions) {
  const duration = Number.isFinite(focusDurationMs) ? Math.max(0, Math.trunc(focusDurationMs)) : 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let focused = false;

  const setFocused = (next: boolean) => {
    if (focused === next) return;
    focused = next;
    onChange(next);
  };

  return {
    trigger() {
      setFocused(true);
      if (timerId !== null) {
        clearTimer(timerId);
      }
      timerId = setTimer(() => {
        timerId = null;
        setFocused(false);
      }, duration);
    },
    dispose() {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
    },
    isFocused() {
      return focused;
    },
  };
}

export function resolveExploreV2CarouselItems(input: {
  listing: Property;
  imageRecords: ExploreImageRecord[];
}): {
  items: UnifiedImageCarouselItem[];
  hasRealImage: boolean;
} {
  const listingTitle =
    formatListingTitle(input.listing.title || "") || input.listing.title || "Explore listing image";
  const dedupedUrls = new Set<string>();
  const orderedRecords = input.imageRecords
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const leftPosition =
        typeof left.record.position === "number" && Number.isFinite(left.record.position)
          ? left.record.position
          : Number.POSITIVE_INFINITY;
      const rightPosition =
        typeof right.record.position === "number" && Number.isFinite(right.record.position)
          ? right.record.position
          : Number.POSITIVE_INFINITY;
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;

      const leftCreatedAt = resolveCreatedAtTimestamp(left.record.created_at ?? null);
      const rightCreatedAt = resolveCreatedAtTimestamp(right.record.created_at ?? null);
      if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

      return left.index - right.index;
    });

  const items: UnifiedImageCarouselItem[] = [];
  for (const { record } of orderedRecords) {
    const normalizedUrl = normalizeExploreGalleryImageUrl(record.image_url, "");
    if (!normalizedUrl || dedupedUrls.has(normalizedUrl)) continue;
    dedupedUrls.add(normalizedUrl);
    const placeholder = resolveExploreImagePlaceholderMeta({
      imageUrl: normalizedUrl,
      imageRecord: record,
    });
    items.push({
      id: record.id,
      src: normalizedUrl,
      alt: listingTitle,
      placeholderColor: placeholder.dominantColor,
      placeholderBlurDataURL: placeholder.blurDataURL,
      placeholderSource: placeholder.source,
    });
  }

  if (items.length > 0) {
    return {
      items,
      hasRealImage: true,
    };
  }

  const fallbackCoverUrl = normalizeExploreGalleryImageUrl(input.listing.cover_image_url, "");
  if (fallbackCoverUrl) {
    const placeholder = resolveExploreImagePlaceholderMeta({ imageUrl: fallbackCoverUrl });
    return {
      items: [
        {
          id: `${input.listing.id}-cover`,
          src: fallbackCoverUrl,
          alt: listingTitle,
          placeholderColor: placeholder.dominantColor,
          placeholderBlurDataURL: placeholder.blurDataURL,
          placeholderSource: placeholder.source,
        },
      ],
      hasRealImage: true,
    };
  }

  return {
    items: [],
    hasRealImage: false,
  };
}

function ExploreV2CardInner({
  listing,
  marketCurrency,
  imageRecords,
  index = 0,
  feedSize = 0,
  viewerIsAuthenticated = false,
}: ExploreV2CardProps) {
  const [ctaSheetOpen, setCtaSheetOpen] = useState(false);
  const [saveAuthSheetOpen, setSaveAuthSheetOpen] = useState(false);
  const [overlayFocused, setOverlayFocused] = useState(false);
  const [glassToast, setGlassToast] = useState<ExploreV2GlassToastState>(null);
  const [savePulseActive, setSavePulseActive] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayFocusController = useMemo(
    () =>
      createExploreV2OverlayFocusController({
        onChange: setOverlayFocused,
      }),
    []
  );
  const resolvedImageRecords = useMemo(
    () => imageRecords ?? resolveExplorePropertyImageRecords(listing),
    [imageRecords, listing]
  );
  const heroCarousel = useMemo(
    () =>
      resolveExploreV2CarouselItems({
        listing,
        imageRecords: resolvedImageRecords,
      }),
    [listing, resolvedImageRecords]
  );
  const heroUiState = useMemo(
    () => resolveExploreV2HeroUiState(heroCarousel.items.length),
    [heroCarousel.items.length]
  );
  const price = useMemo(
    () => resolveExplorePriceCopy(listing, { marketCurrency, stayContext: null }),
    [listing, marketCurrency]
  );
  const priceClarity = useMemo(
    () => resolveExplorePriceClarityCopy(listing, { marketCurrency, stayContext: null }),
    [listing, marketCurrency]
  );
  const detailsHref = useMemo(() => resolveExploreDetailsHref(listing), [listing]);
  const primaryAction = useMemo(() => resolveExplorePrimaryAction(listing), [listing]);
  const listingKind = useMemo(() => resolveExploreListingKind(listing), [listing]);
  const actionContext = useMemo(
    () =>
      resolveExploreV2ActionContext({
        listing,
        index,
        feedSize,
      }),
    [feedSize, index, listing]
  );
  const intentTag = useMemo(() => resolveExploreIntentTag(listing), [listing]);
  const locationLine = useMemo(() => resolveExploreV2LocationLine(listing), [listing]);
  const formattedTitle = useMemo(
    () => formatListingTitle(listing.title || "") || listing.title || "Untitled listing",
    [listing.title]
  );
  const overlayOpacityClass = useMemo(
    () => resolveExploreV2OverlayOpacityClass(overlayFocused),
    [overlayFocused]
  );
  const showFeaturedVideoBadge = resolveExploreV2HasVideo(listing);
  const videoTourHref = useMemo(() => resolveExploreV2VideoTourHref(detailsHref), [detailsHref]);
  const sheetThumbnailSrc = heroCarousel.items[0]?.src ?? listing.cover_image_url ?? null;

  useEffect(() => {
    return () => {
      overlayFocusController.dispose();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (savePulseTimerRef.current) clearTimeout(savePulseTimerRef.current);
    };
  }, [overlayFocusController]);

  const showGlassToast = useCallback((next: ExploreV2GlassToastState) => {
    setGlassToast(next);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    if (!next) return;
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setGlassToast(null);
    }, EXPLORE_V2_GLASS_TOAST_DISMISS_MS);
  }, []);

  const handleSaveToggle = useCallback(
    (saved: boolean) => {
      trackExploreV2SaveToggle({ context: actionContext, saved });
      setSavePulseActive(true);
      if (savePulseTimerRef.current) {
        clearTimeout(savePulseTimerRef.current);
      }
      savePulseTimerRef.current = setTimeout(() => {
        savePulseTimerRef.current = null;
        setSavePulseActive(false);
      }, 160);
      showGlassToast({
        message: resolveExploreV2SaveFeedbackMessage(saved),
        tone: "success",
        showRetry: false,
      });
    },
    [actionContext, showGlassToast]
  );

  const handleSheetSaveToggle = useCallback(
    (saved: boolean) => {
      handleSaveToggle(saved);
      trackExploreV2CtaSaveClicked({
        context: actionContext,
        result: saved ? "saved" : "unsaved",
      });
    },
    [actionContext, handleSaveToggle]
  );

  const handleShare = useCallback(async (source: "rail" | "sheet" = "rail") => {
    const result = await triggerExploreV2ShareAction({
      detailsHref,
      title: formattedTitle,
      locationLine,
      context: actionContext,
    });
    if (source === "sheet") {
      trackExploreV2CtaShareClicked({
        context: actionContext,
        result: result === "error" ? "error" : result,
      });
    }
    showGlassToast(resolveExploreV2ShareFeedback(result));
  }, [actionContext, detailsHref, formattedTitle, locationLine, showGlassToast]);

  const resolveAuthRedirectPath = useCallback(
    (basePath: "/auth/login" | "/auth/register") => {
      if (typeof window === "undefined") return `${basePath}?reason=auth&redirect=%2Fexplore-v2`;
      const redirectTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      return `${basePath}?reason=auth&redirect=${encodeURIComponent(redirectTarget)}`;
    },
    []
  );

  const handleSaveSurfaceCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (viewerIsAuthenticated) return;
      event.preventDefault();
      event.stopPropagation();
      setSaveAuthSheetOpen(true);
    },
    [viewerIsAuthenticated]
  );

  const handleSheetSaveSurfaceCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (viewerIsAuthenticated) return;
      trackExploreV2CtaSaveClicked({
        context: actionContext,
        result: "auth_required",
      });
      event.preventDefault();
      event.stopPropagation();
      setSaveAuthSheetOpen(true);
    },
    [actionContext, viewerIsAuthenticated]
  );

  const openCtaSheet = useCallback(() => {
    trackExploreFunnelEvent({
      name: "explore_v2_cta_open",
      listingId: actionContext.listingId,
      marketCode: actionContext.marketCode,
      intentType: actionContext.intentType,
      index: actionContext.index,
      feedSize: actionContext.feedSize,
      action: primaryAction.label.toLowerCase(),
    });
    trackExploreV2CtaSheetOpened({
      context: actionContext,
      label: primaryAction.label,
    });
    setCtaSheetOpen(true);
  }, [actionContext, primaryAction.label]);

  const handleCtaContinue = useCallback(() => {
    setCtaSheetOpen(false);
    continueExploreV2Cta(
      {
        href: primaryAction.href,
        label: primaryAction.label,
        context: actionContext,
      },
      {
        pushFn: (href) => {
          if (typeof window !== "undefined") {
            window.location.assign(href);
          }
        },
      }
    );
  }, [actionContext, primaryAction.href, primaryAction.label]);

  const handleViewDetails = useCallback(() => {
    setCtaSheetOpen(false);
    continueExploreV2ViewDetails(
      {
        href: detailsHref,
        context: actionContext,
      },
      {
        pushFn: (href) => {
          if (typeof window !== "undefined") {
            window.location.assign(href);
          }
        },
      }
    );
  }, [actionContext, detailsHref]);

  const handleHeroInteractionCapture = useCallback(() => {
    overlayFocusController.trigger();
  }, [overlayFocusController]);

  const titleText = formattedTitle;
  const { ref: titleRef, isTruncated: isTitleTruncated } = useIsTruncated<HTMLParagraphElement>();
  const titleTooltipEnabled = shouldShowExploreV2TitleTooltip({
    title: titleText,
    isTruncated: isTitleTruncated,
  });

  return (
    <>
      <article
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
        data-testid="explore-v2-card"
      >
        <div
          className="relative aspect-[4/5] min-h-[320px] w-full overflow-hidden"
          data-testid="explore-v2-hero"
          onPointerDownCapture={handleHeroInteractionCapture}
          onTouchStartCapture={handleHeroInteractionCapture}
          onFocusCapture={handleHeroInteractionCapture}
        >
          <UnifiedImageCarousel
            items={heroCarousel.items}
            fallbackImage={EXPLORE_GALLERY_FALLBACK_IMAGE}
            sizes="(max-width: 768px) 100vw, 460px"
            className="h-full w-full"
            rootTestId="explore-v2-hero-carousel"
            dotsTestId="explore-v2-hero-carousel-dots"
            showArrows={false}
            showDots={heroUiState.showDots}
            dotsClassName="bottom-3"
            showCountBadge={heroUiState.showCountBadge}
            countBadgeClassName={glassSurface("right-4 top-4 px-2.5 py-0.5 text-white")}
            prioritizeFirstImage
            renderWindowRadius={1}
            progressiveUpgradeOnIdle
            maxConcurrentImageLoads={2}
            showLoadingCue={heroUiState.showSwipeAffordance}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-slate-950/42 via-slate-950/14 to-transparent"
            aria-hidden
          />
          {heroCarousel.hasRealImage ? (
            <span className="sr-only" data-testid="explore-v2-hero-has-image">
              Hero image available
            </span>
          ) : null}
          {!heroCarousel.hasRealImage ? (
            <span
              className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white"
              data-testid="explore-v2-hero-image-unavailable"
            >
              Image unavailable
            </span>
          ) : null}
          {showFeaturedVideoBadge ? (
            <Link
              href={videoTourHref}
              onClick={(event) => {
                event.stopPropagation();
              }}
              className={cn(
                "absolute left-4 top-4 z-30 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white",
                glassSurface("rounded-full")
              )}
              data-testid="explore-v2-video-badge"
              aria-label={`Open video tour for ${formattedTitle || "listing"}`}
            >
              <span aria-hidden>▶</span>
              <span>Video tour</span>
            </Link>
          ) : null}
          <div className="pointer-events-none absolute inset-0 z-20">
            <div
              className={cn(
                "pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-3 transition-opacity duration-200 ease-out motion-reduce:transition-none focus-within:opacity-100",
                overlayOpacityClass
              )}
              data-testid="explore-v2-action-rail"
            >
              <div
                className={glassSurface(
                  cn(
                    "inline-flex h-11 w-11 items-center justify-center p-0.5 transition-transform duration-150 ease-out",
                    savePulseActive ? "scale-[1.05] ring-2 ring-white/55" : ""
                  )
                )}
                data-testid="explore-v2-save-surface"
                onClickCapture={handleSaveSurfaceCapture}
              >
                <SaveToggle
                  itemId={listing.id}
                  kind={listingKind}
                  href={detailsHref}
                  title={formattedTitle}
                  subtitle={locationLine}
                  tag={intentTag}
                  marketCountry={actionContext.marketCode}
                  testId={`explore-v2-save-toggle-${listing.id}`}
                  onToggle={handleSaveToggle}
                  className={cn(
                    "mx-auto h-10 w-10 rounded-full border-transparent bg-transparent text-white ring-0 shadow-none hover:bg-white/10 hover:text-white",
                    !viewerIsAuthenticated ? "pointer-events-none" : ""
                  )}
                />
              </div>
              <div
                className={glassSurface("inline-flex h-11 w-11 items-center justify-center p-0.5")}
                data-testid="explore-v2-share-surface"
              >
                <button
                  type="button"
                  onClick={() => {
                    void handleShare();
                  }}
                  className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white"
                  aria-label="Share listing"
                  data-testid="explore-v2-share-action"
                >
                  ↗
                </button>
              </div>
            </div>
            <div
              className={cn(
                "pointer-events-auto absolute bottom-[76px] right-4 transition-opacity duration-200 ease-out motion-reduce:transition-none focus-within:opacity-100",
                overlayOpacityClass
              )}
              data-testid="explore-v2-cta-container"
            >
              <button
                type="button"
                onClick={openCtaSheet}
                className={glassSurface(
                  "inline-flex h-10 min-w-[112px] max-w-[156px] items-center justify-center px-3.5 text-xs font-semibold leading-none"
                )}
                aria-label={`${primaryAction.label} for ${formattedTitle || "listing"}`}
                data-testid="explore-v2-cta-action"
              >
                {primaryAction.label}
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-2 px-4 py-3.5">
          <GlassTooltip
            content={titleText}
            disabled={!titleTooltipEnabled}
            testId="explore-v2-title-tooltip"
          >
            <p
              ref={titleRef}
              className="line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-5 text-slate-900"
              aria-label={titleText}
              data-testid="explore-v2-title"
              tabIndex={titleTooltipEnabled ? 0 : undefined}
            >
              {titleText}
            </p>
          </GlassTooltip>
          <p className="truncate text-[13px] leading-5 text-slate-500" data-testid="explore-v2-location">
            {locationLine}
          </p>
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <p className="truncate text-base font-semibold leading-5 text-slate-950" data-testid="explore-v2-price">
              {price.primary}
            </p>
            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium leading-none text-slate-600">
              {intentTag}
            </span>
          </div>
        </div>
      </article>
      <ExploreV2ConversionSheet
        open={ctaSheetOpen}
        onOpenChange={setCtaSheetOpen}
        sheetId={`explore-v2-cta-sheet-${listing.id}`}
        title={formattedTitle}
        locationLine={locationLine}
        priceClarity={priceClarity}
        intentTag={intentTag}
        hasVideo={showFeaturedVideoBadge}
        thumbnailSrc={sheetThumbnailSrc}
        primaryActionLabel={primaryAction.label}
        onPrimaryAction={handleCtaContinue}
        detailsHref={detailsHref}
        onViewDetails={handleViewDetails}
        onShare={() => {
          void handleShare("sheet");
        }}
        onSaveSurfaceCapture={handleSheetSaveSurfaceCapture}
        viewerIsAuthenticated={viewerIsAuthenticated}
        saveToggle={{
          itemId: listing.id,
          kind: listingKind,
          href: detailsHref,
          title: formattedTitle,
          subtitle: locationLine,
          tag: intentTag,
          marketCountry: actionContext.marketCode,
          onToggle: handleSheetSaveToggle,
        }}
      />
      <BottomSheet
        open={saveAuthSheetOpen}
        onOpenChange={setSaveAuthSheetOpen}
        title="Sign in to save listings"
        description="Save favourites across devices and revisit them anytime."
        testId="explore-v2-save-auth-sheet"
        sheetId={`explore-v2-save-auth-sheet-${listing.id}`}
      >
        <div className="space-y-2.5">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.assign(resolveAuthRedirectPath("/auth/login"));
              }
            }}
            data-testid="explore-v2-save-auth-sign-in"
          >
            Sign in
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.assign(resolveAuthRedirectPath("/auth/register"));
              }
            }}
            data-testid="explore-v2-save-auth-create-account"
          >
            Create account
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-full border border-transparent bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600"
            onClick={() => setSaveAuthSheetOpen(false)}
            data-testid="explore-v2-save-auth-not-now"
          >
            Not now
          </button>
        </div>
      </BottomSheet>
      {glassToast ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
          data-testid="explore-v2-glass-toast-anchor"
          style={{
            bottom: resolveExploreV2GlassToastBottom(),
          }}
        >
          <div
            className={resolveExploreV2GlassToastClassName(glassToast.tone)}
            data-testid="explore-v2-glass-toast"
          >
            <span>{glassToast.message}</span>
            {glassToast.showRetry ? (
              <button
                type="button"
                className="pointer-events-auto rounded-full border border-white/35 px-2 py-0.5 text-[11px] font-semibold"
                onClick={() => {
                  void handleShare();
                }}
                data-testid="explore-v2-glass-toast-retry"
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export const ExploreV2Card = memo(ExploreV2CardInner);
