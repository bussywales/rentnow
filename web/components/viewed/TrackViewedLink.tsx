"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { pushRecentFeaturedTap } from "@/lib/search/featured-taps";
import { pushViewedItem, type ViewedItemInput } from "@/lib/viewed";

type TrackViewedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    viewedItem: Omit<ViewedItemInput, "marketCountry"> & {
      marketCountry?: string | null;
    };
    featuredTap?: {
      id: string;
      kind: "shortlet" | "property";
      href: string;
      label: string;
      query?: string | null;
      marketCountry?: string | null;
    };
  };

function normalizeMarketCountry(value: string | null | undefined, fallback: string): string {
  const candidate = (value ?? "").trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(candidate)) return candidate;
  return fallback;
}

export function TrackViewedLink({
  viewedItem,
  featuredTap,
  onClick,
  ...props
}: TrackViewedLinkProps) {
  const { market } = useMarketPreference();

  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        pushViewedItem({
          ...viewedItem,
          marketCountry: normalizeMarketCountry(viewedItem.marketCountry, market.country),
        });
        if (featuredTap) {
          pushRecentFeaturedTap({
            ...featuredTap,
            marketCountry: normalizeMarketCountry(featuredTap.marketCountry, market.country),
          });
        }
      }}
    />
  );
}
