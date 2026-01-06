"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import {
  formatCadence,
  formatLocationLabel,
  formatPriceValue,
} from "@/lib/property-discovery";
import { TrustBadges } from "@/components/trust/TrustBadges";
import type { TrustMarkerState } from "@/lib/trust-markers";

const BedIcon = () => (
  <svg
    aria-hidden
    className="h-4 w-4 text-slate-500"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M4 12V7a1 1 0 0 1 1-1h6v6" />
    <path d="M4 21v-3" />
    <path d="M20 21v-3" />
    <path d="M4 15h16v-3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" />
  </svg>
);

const BathIcon = () => (
  <svg
    aria-hidden
    className="h-4 w-4 text-slate-500"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M7 4a3 3 0 1 1 6 0v6" />
    <path d="M4 10h14" />
    <path d="M5 20h12" />
    <path d="M5 16h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
    <path d="M15 4h1" />
    <path d="M15 7h2" />
  </svg>
);

type Props = {
  property: Property;
  href?: string;
  compact?: boolean;
  trustMarkers?: TrustMarkerState | null;
};

export function PropertyCard({ property, href, compact, trustMarkers }: Props) {
  const fallbackImage =
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80";
  const primaryImage = property.images?.[0]?.image_url || fallbackImage;
  const [imgSrc, setImgSrc] = useState(primaryImage);
  const blurDataURL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  const locationLabel = formatLocationLabel(property.city, property.neighbourhood);
  const priceValue = formatPriceValue(property.currency, property.price);
  const cadence = formatCadence(property.rental_type);
  const description =
    typeof property.description === "string" && property.description.trim().length > 0
      ? property.description
      : "No description provided yet.";

  const body = (
    <div
      className={cn(
        "card h-full overflow-hidden rounded-2xl bg-white transition hover:-translate-y-0.5 hover:shadow-xl",
        compact && "flex"
      )}
    >
      <div className={cn("relative", compact ? "h-32 w-32 flex-none" : "h-52")}>
        <Image
          src={imgSrc}
          alt={property.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 320px"
          priority={false}
          placeholder="blur"
          blurDataURL={blurDataURL}
          onError={() => {
            if (imgSrc !== fallbackImage) setImgSrc(fallbackImage);
          }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              {locationLabel}
            </p>
            <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
              {property.title}
            </h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-700 whitespace-nowrap shrink-0">
            {property.rental_type === "short_let" ? "Short-let" : "Long-term"}
          </span>
        </div>
        <p className="min-h-[40px] text-sm text-slate-600 line-clamp-2">
          {description}
        </p>
        {trustMarkers && (
          <TrustBadges markers={trustMarkers} compact />
        )}
        <div className="flex items-center justify-between text-sm text-slate-800">
          <div className="font-semibold">
            {priceValue}
            <span className="text-xs font-normal text-slate-500">
              {` / ${cadence}`}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <BedIcon />
              {property.bedrooms}
            </span>
            <span className="flex items-center gap-1">
              <BathIcon />
              {property.bathrooms}
            </span>
            <span>{property.furnished ? "Furnished" : "Unfurnished"}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }

  return body;
}
