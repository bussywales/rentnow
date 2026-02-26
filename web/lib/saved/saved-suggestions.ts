import {
  selectPropertiesFeaturedRailItems,
  selectShortletsFeaturedRailItems,
  type DiscoveryTrustBadge,
} from "@/lib/discovery";

export type SavedSuggestionItem = {
  id: string;
  kind: "shortlet" | "property";
  href: string;
  title: string;
  subtitle: string;
  tag: string;
  badges: DiscoveryTrustBadge[];
};

export type SavedSuggestions = {
  shortlets: SavedSuggestionItem[];
  properties: SavedSuggestionItem[];
};

type BuildSavedSuggestionsInput = {
  marketCountry: string;
  now?: Date;
  limitPerSection?: number;
};

export function buildSavedSuggestions(input: BuildSavedSuggestionsInput): SavedSuggestions {
  const limitPerSection = Math.max(1, Math.min(6, input.limitPerSection ?? 4));
  const shortlets = selectShortletsFeaturedRailItems({
    marketCountry: input.marketCountry,
    limit: limitPerSection,
    now: input.now,
    seedBucket: "saved-empty-shortlets",
  }).map((item) => ({
    id: item.id,
    kind: "shortlet" as const,
    href: item.href,
    title: item.title,
    subtitle: item.subtitle,
    tag: item.tag,
    badges: item.badges,
  }));

  const properties = selectPropertiesFeaturedRailItems({
    marketCountry: input.marketCountry,
    limit: limitPerSection,
    now: input.now,
    seedBucket: "saved-empty-properties",
  }).map((item) => ({
    id: item.id,
    kind: "property" as const,
    href: item.href,
    title: item.title,
    subtitle: item.subtitle,
    tag: item.tag,
    badges: item.badges,
  }));

  return { shortlets, properties };
}
