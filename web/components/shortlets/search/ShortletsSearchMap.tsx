"use client";

import dynamic from "next/dynamic";

const ShortletsSearchMapClient = dynamic(
  () =>
    import("./ShortletsSearchMap.client").then((mod) => ({
      default: mod.ShortletsSearchMapClient,
    })),
  { ssr: false }
);

type Props = {
  listings: Array<{
    id: string;
    title: string;
    city: string;
    currency: string;
    nightlyPriceMinor: number | null;
    pricingMode: "nightly" | "price_on_request";
    bookingMode: "instant" | "request";
    primaryImageUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    href: string;
  }>;
  selectedListingId: string | null;
  hoveredListingId: string | null;
  onSelectListing: (listingId: string) => void;
  onHoverListing: (listingId: string | null) => void;
  onBoundsChanged: (bounds: { north: number; south: number; east: number; west: number }) => void;
  marketCountry: string;
  resultHash: string;
  cameraIntent: "initial" | "idle" | "user_search" | "user_search_area" | "location_change";
  cameraIntentNonce: number;
  fitRequestKey: string;
  resolvedFitRequestKey: string;
  preferredCenter?: [number, number] | null;
  height?: string;
  invalidateNonce?: number;
};

export function ShortletsSearchMap(props: Props) {
  return <ShortletsSearchMapClient {...props} />;
}
