import type { DiscoveryCatalogueItem, DiscoveryTrustBadge } from "@/lib/discovery";

export type RecoItemKind = "shortlet" | "property";
export type RecoReasonCode = "SAVED" | "VIEWED" | "CONTINUE_BROWSING" | "FALLBACK_POPULAR";

export type RecoSignalItem = {
  id: string;
  kind: RecoItemKind;
  href: string;
  marketCountry?: string | null;
  timestamp?: string | null;
};

export type BuildRecommendedNextItemsInput = {
  marketCountry?: string | null;
  savedItems?: ReadonlyArray<RecoSignalItem>;
  viewedItems?: ReadonlyArray<RecoSignalItem>;
  lastBrowseHref?: string | null;
  lastSearchHref?: string | null;
  limit?: number;
  now?: Date;
  seedBucket?: string | null;
  items?: ReadonlyArray<DiscoveryCatalogueItem>;
};

export type RecommendedNextItem = {
  id: string;
  kind: RecoItemKind;
  title: string;
  subtitle: string;
  tag: string;
  href: string;
  reasonCode: RecoReasonCode;
  reason: string;
  badges: DiscoveryTrustBadge[];
};
