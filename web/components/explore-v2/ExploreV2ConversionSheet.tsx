"use client";

import { type MouseEvent } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { SafeImage } from "@/components/ui/SafeImage";
import { cn } from "@/components/ui/cn";
import { EXPLORE_GALLERY_FALLBACK_IMAGE } from "@/lib/explore/gallery-images";
import type { ExplorePriceClarityCopy } from "@/lib/explore/explore-presentation";
import { glassSurface } from "@/lib/ui/glass";
import type { SavedItemKind } from "@/lib/saved";

type ExploreV2ConversionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetId: string;
  title: string;
  locationLine: string;
  priceClarity: ExplorePriceClarityCopy;
  intentTag: string;
  hasVideo: boolean;
  thumbnailSrc: string | null;
  trustCueCopy: string | null;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  detailsHref: string;
  detailsActionLabel?: string;
  onViewDetails: () => void;
  onShare: () => void;
  onSaveSurfaceCapture: (event: MouseEvent<HTMLDivElement>) => void;
  viewerIsAuthenticated: boolean;
  saveToggle: {
    itemId: string;
    kind: SavedItemKind;
    href: string;
    title: string;
    subtitle: string;
    tag: string;
    marketCountry: string;
    onToggle: (saved: boolean) => void;
  };
};

export function ExploreV2ConversionSheet({
  open,
  onOpenChange,
  sheetId,
  title,
  locationLine,
  priceClarity,
  intentTag,
  hasVideo,
  thumbnailSrc,
  trustCueCopy,
  primaryActionLabel,
  onPrimaryAction,
  detailsHref,
  detailsActionLabel = "View details",
  onViewDetails,
  onShare,
  onSaveSurfaceCapture,
  viewerIsAuthenticated,
  saveToggle,
}: ExploreV2ConversionSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Quick action"
      description={primaryActionLabel}
      testId="explore-v2-cta-sheet"
      sheetId={sheetId}
    >
      <div className="space-y-3.5" data-testid="explore-v2-conversion-sheet-content">
        <div className={cn(glassSurface("rounded-2xl border-white/12 p-3"), "flex items-start gap-3")}>
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/15">
            <SafeImage
              src={thumbnailSrc || EXPLORE_GALLERY_FALLBACK_IMAGE}
              alt={title}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold text-white" data-testid="explore-v2-cta-summary-title">
              {title}
            </p>
            <p className="mt-0.5 truncate text-xs text-white/80" data-testid="explore-v2-cta-summary-location">
              {locationLine}
            </p>
            <p className="mt-1.5 flex items-baseline gap-1 text-sm text-white" data-testid="explore-v2-cta-summary-price">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/70">From</span>
              <span className="text-base font-semibold text-white" data-testid="explore-v2-cta-price-amount">
                {priceClarity.amount}
              </span>
              {priceClarity.suffix ? (
                <span className="text-[13px] font-medium text-white/85" data-testid="explore-v2-cta-price-suffix">
                  {priceClarity.suffix}
                </span>
              ) : null}
            </p>
            {priceClarity.note ? (
              <p className="mt-0.5 text-[11px] text-white/75" data-testid="explore-v2-cta-price-note">
                {priceClarity.note}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/25 bg-white/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                {intentTag}
              </span>
              {hasVideo ? (
                <span className="rounded-full border border-white/25 bg-white/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                  Video
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {trustCueCopy ? (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2"
            data-testid="explore-v2-cta-trust-cue"
          >
            <p className="text-xs font-medium text-emerald-900">{trustCueCopy}</p>
          </div>
        ) : null}

        <button
          type="button"
          className={glassSurface("inline-flex h-11 w-full items-center justify-center px-4 text-sm font-semibold")}
          onClick={onPrimaryAction}
          data-testid="explore-v2-cta-continue"
          aria-label={`${primaryActionLabel} for ${title}`}
        >
          {primaryActionLabel}
        </button>

        <div className="grid grid-cols-3 gap-2" data-testid="explore-v2-cta-secondary-actions">
          <Link
            href={detailsHref}
            onClick={(event) => {
              event.preventDefault();
              onViewDetails();
            }}
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700"
            data-testid="explore-v2-cta-view-details"
          >
            {detailsActionLabel}
          </Link>
          <div
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white"
            onClickCapture={onSaveSurfaceCapture}
            data-testid="explore-v2-cta-save-surface"
          >
            <SaveToggle
              itemId={saveToggle.itemId}
              kind={saveToggle.kind}
              href={saveToggle.href}
              title={saveToggle.title}
              subtitle={saveToggle.subtitle}
              tag={saveToggle.tag}
              marketCountry={saveToggle.marketCountry}
              testId={`explore-v2-cta-save-toggle-${saveToggle.itemId}`}
              onToggle={saveToggle.onToggle}
              className={cn(
                "h-9 w-9 rounded-full border-transparent bg-transparent text-slate-700 shadow-none ring-0 hover:bg-slate-100",
                !viewerIsAuthenticated ? "pointer-events-none" : ""
              )}
            />
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700"
            onClick={onShare}
            data-testid="explore-v2-cta-share-action"
          >
            Share
          </button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          onClick={() => onOpenChange(false)}
          data-testid="explore-v2-cta-close"
        >
          Close
        </button>
      </div>
    </BottomSheet>
  );
}
