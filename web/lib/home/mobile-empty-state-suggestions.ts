import { selectPropertiesFeaturedRailItems, selectShortletsFeaturedRailItems } from "@/lib/discovery";

export type MobileEmptyStateSuggestion = {
  id: string;
  href: string;
  label: string;
};

export function getMobileEmptyStateSuggestions(input: {
  marketCountry: string;
  limit?: number;
}): MobileEmptyStateSuggestion[] {
  const limit = Math.max(1, Math.min(6, input.limit ?? 3));
  const shortlets = selectShortletsFeaturedRailItems({
    marketCountry: input.marketCountry,
    limit,
    seedBucket: "mobile-empty-shortlets",
  }).map((item) => ({
    id: item.id,
    href: item.href,
    label: item.title,
  }));
  const properties = selectPropertiesFeaturedRailItems({
    marketCountry: input.marketCountry,
    limit,
    seedBucket: "mobile-empty-properties",
  }).map((item) => ({
    id: item.id,
    href: item.href,
    label: item.title,
  }));

  const merged: MobileEmptyStateSuggestion[] = [];
  const seen = new Set<string>();

  for (let index = 0; merged.length < limit && index < limit; index += 1) {
    const shortlet = shortlets[index];
    if (shortlet && !seen.has(shortlet.id)) {
      merged.push(shortlet);
      seen.add(shortlet.id);
      if (merged.length >= limit) break;
    }
    const property = properties[index];
    if (property && !seen.has(property.id)) {
      merged.push(property);
      seen.add(property.id);
      if (merged.length >= limit) break;
    }
  }

  return merged.slice(0, limit);
}
