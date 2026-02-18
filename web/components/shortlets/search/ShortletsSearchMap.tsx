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
    currency: string;
    nightlyPriceMinor: number | null;
    latitude: number | null;
    longitude: number | null;
  }>;
  selectedListingId: string | null;
  onSelectListing: (listingId: string) => void;
  onBoundsChanged: (bounds: { north: number; south: number; east: number; west: number }) => void;
  height?: string;
};

export function ShortletsSearchMap(props: Props) {
  return <ShortletsSearchMapClient {...props} />;
}

