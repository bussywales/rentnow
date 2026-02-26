import type { DiscoveryCatalogueItem, DiscoveryTrustBadge } from "@/lib/discovery";

export type RecoItemKind = "shortlet" | "property";
export type RecoReason =
  | "Continue browsing"
  | "Based on your saved"
  | "Because you viewed"
  | "Popular in your market";

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
  reason: RecoReason;
  badges: DiscoveryTrustBadge[];
};
