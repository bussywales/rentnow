"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { formatCadence, formatLocationLabel, formatPriceValue } from "@/lib/property-discovery";
import { resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import type { Property } from "@/lib/types";
import {
  resolveExploreCtaMicrocopy,
  resolveExploreDetailsHref,
  resolveExploreListingKind,
  resolveExplorePrimaryAction,
  resolveExploreViewingRequestTemplate,
} from "@/lib/explore/explore-presentation";
import { EXPLORE_GALLERY_FALLBACK_IMAGE } from "@/lib/explore/gallery-images";
import { shouldBypassNextImageOptimizer } from "@/lib/images/optimizer-bypass";
import { ExploreCtaNextStepsSheet } from "@/components/explore/ExploreCtaNextStepsSheet";

type ExploreDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  similarHomes?: Property[];
  onSelectSimilarHome?: (listingId: string) => boolean;
  onPrimaryActionTap?: (actionLabel: "Book" | "Request viewing") => void;
};

const EXPLORE_FALLBACK_IMAGE = EXPLORE_GALLERY_FALLBACK_IMAGE;
const DEFAULT_TIMEZONE = "Africa/Lagos";

type AvailabilityChip = "Weekdays" | "Weekends" | "Evenings";

function factsForProperty(property: Property): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  if (Number.isFinite(property.bedrooms)) facts.push({ label: "Beds", value: String(property.bedrooms) });
  if (Number.isFinite(property.bathrooms)) facts.push({ label: "Baths", value: String(property.bathrooms) });
  if (Number.isFinite(property.max_guests)) facts.push({ label: "Guests", value: String(property.max_guests) });
  return facts;
}

function resolveLocalDateForTimezone(timeZone: string, dayOffset = 1): string {
  const targetDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(targetDate);
}

function appendAvailabilityToMessage(message: string, chip: AvailabilityChip): string {
  const availabilityText =
    chip === "Weekdays"
      ? "weekdays"
      : chip === "Weekends"
        ? "weekends"
        : "evenings";
  if (message.includes("[days/times]")) {
    return message.replace("[days/times]", availabilityText);
  }
  if (message.toLowerCase().includes(`available ${availabilityText}`)) {
    return message;
  }
  return `${message.trim()} Available ${availabilityText}.`;
}

export function ExploreDetailsSheet({
  open,
  onOpenChange,
  property,
  similarHomes = [],
  onSelectSimilarHome,
  onPrimaryActionTap,
}: ExploreDetailsSheetProps) {
  const router = useRouter();
  const { market } = useMarketPreference();
  const location = formatLocationLabel(property.city, property.neighbourhood);
  const detailsHref = resolveExploreDetailsHref(property);
  const primaryAction = resolveExplorePrimaryAction(property);
  const primaryMicrocopy = resolveExploreCtaMicrocopy(property);
  const shortletNightlyMinor = resolveShortletNightlyPriceMinor(property);
  const displayPrice =
    typeof shortletNightlyMinor === "number" && Number.isFinite(shortletNightlyMinor) && shortletNightlyMinor > 0
      ? shortletNightlyMinor / 100
      : property.price;
  const price = formatPriceValue(property.currency, displayPrice, {
    marketCurrency: market.currency,
  });
  const cadence = formatCadence(property.rental_type, property.rent_period);
  const facts = factsForProperty(property);
  const topAmenities = (property.amenities ?? []).slice(0, 5);
  const similarItems = similarHomes.slice(0, 3);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState(resolveExploreViewingRequestTemplate(property));
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  useEffect(() => {
    setRequestMessage(resolveExploreViewingRequestTemplate(property));
    setRequestError(null);
    setRequestSuccess(null);
  }, [property]);

  const handleNextStepPrimaryAction = async () => {
    onPrimaryActionTap?.(primaryAction.label);
    if (primaryAction.label === "Book") {
      setNextStepsOpen(false);
      router.push(primaryAction.href);
      return;
    }

    setRequestSubmitting(true);
    setRequestError(null);
    setRequestSuccess(null);

    try {
      const timezone = property.timezone || DEFAULT_TIMEZONE;
      const preferredDate = resolveLocalDateForTimezone(timezone, 1);
      const response = await fetch("/api/viewings/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          preferred_date: preferredDate,
          message: requestMessage.trim() || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent(primaryAction.href)}`);
          return;
        }
        setRequestError(payload?.error?.trim() || "Unable to send request right now. Continue in full details.");
        return;
      }

      setRequestSuccess("Request sent. We will notify you once the host responds.");
      window.setTimeout(() => {
        setNextStepsOpen(false);
        router.push(primaryAction.href);
      }, 600);
    } catch {
      setRequestError("Unable to send request right now. Continue in full details.");
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={property.title}
        description={location}
        testId="explore-details-sheet"
        sheetId={`explore-details-sheet-${property.id}`}
      >
        <div className="space-y-4" data-testid="explore-details-content">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-900">{price}</p>
            {cadence ? <p className="text-xs text-slate-500">per {cadence}</p> : null}
          </div>

          {facts.length ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              {facts.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{fact.label}</p>
                  <p className="text-sm font-semibold text-slate-900">{fact.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {topAmenities.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Top amenities</p>
              <div className="flex flex-wrap gap-1.5">
                {topAmenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <p className="line-clamp-4 text-sm text-slate-600">
            {property.description?.trim() || "Explore this listing for photos, details, and booking options."}
          </p>

          {similarItems.length ? (
            <div className="space-y-2" data-testid="explore-similar-homes">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Similar homes</p>
              <div className="grid grid-cols-1 gap-2">
                {similarItems.map((similar) => {
                  const previewImage =
                    resolvePropertyImageSources({
                      coverImageUrl: similar.cover_image_url,
                      images: similar.images,
                      primaryImageUrl: getPrimaryImageUrl(similar),
                      fallbackImage: EXPLORE_FALLBACK_IMAGE,
                    })[0] ?? EXPLORE_FALLBACK_IMAGE;
                  const similarPrice = formatPriceValue(similar.currency, similar.price, {
                    marketCurrency: market.currency,
                  });
                  const similarLocation = formatLocationLabel(similar.city, similar.neighbourhood);
                  const similarDetailsHref = resolveExploreDetailsHref(similar);

                  return (
                    <button
                      key={similar.id}
                      type="button"
                      className="grid grid-cols-[4.5rem,1fr] items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 text-left"
                      data-testid="explore-similar-home"
                      onClick={() => {
                        const handled = onSelectSimilarHome?.(similar.id) ?? false;
                        onOpenChange(false);
                        if (!handled) {
                          router.push(similarDetailsHref);
                        }
                      }}
                    >
                      <div className="relative h-16 w-full overflow-hidden rounded-xl">
                        <Image
                          src={previewImage}
                          alt={similar.title}
                          fill
                          className="object-cover"
                          sizes="72px"
                          unoptimized={shouldBypassNextImageOptimizer(previewImage)}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{similar.title}</p>
                        <p className="truncate text-xs text-slate-600">{similarLocation}</p>
                        <p className="truncate text-xs font-semibold text-slate-700">
                          {similarPrice}
                          {resolveExploreListingKind(similar) === "shortlet" ? " / night" : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="sticky bottom-0 z-10 space-y-2 bg-white pb-1 pt-1">
            <Button
              type="button"
              className="w-full"
              data-testid="explore-primary-cta"
              onClick={() => {
                onOpenChange(false);
                setRequestError(null);
                setRequestSuccess(null);
                setNextStepsOpen(true);
              }}
            >
              {primaryAction.label}
            </Button>
            <p className="px-1 text-center text-[11px] text-slate-500" data-testid="explore-primary-microcopy">
              {primaryMicrocopy}
            </p>
            <Link
              href={detailsHref}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              data-testid="explore-view-full-details"
              onClick={() => onOpenChange(false)}
            >
              View full details
            </Link>
          </div>
        </div>
      </BottomSheet>

      <ExploreCtaNextStepsSheet
        open={nextStepsOpen}
        onOpenChange={setNextStepsOpen}
        actionLabel={primaryAction.label}
        primaryButtonLabel={primaryAction.label === "Book" ? "Continue to booking" : "Send request"}
        onPrimaryAction={() => {
          void handleNextStepPrimaryAction();
        }}
        propertyTitle={property.title}
        requestMessage={requestMessage}
        onRequestMessageChange={setRequestMessage}
        onAvailabilityChipClick={(chip) => {
          setRequestMessage((current) => appendAvailabilityToMessage(current, chip));
        }}
        requestSubmitting={requestSubmitting}
        requestError={requestError}
        requestSuccess={requestSuccess}
      />
    </>
  );
}
