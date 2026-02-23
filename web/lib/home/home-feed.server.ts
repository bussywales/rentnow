import type { Property } from "@/lib/types";
import {
  getFeaturedHomes,
  getMostSavedHomes,
  getMostViewedHomes,
  getNewHomes,
  getShortletHomes,
  type DiscoveryContext,
} from "@/lib/tenant/tenant-discovery.server";

const HOME_RAIL_LIMIT = 6;

function dedupeById(items: Property[]): Property[] {
  const seen = new Set<string>();
  const deduped: Property[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}

function chooseRailItems(primary: Property[], fallback: Property[]): Property[] {
  return dedupeById([...primary, ...fallback]).slice(0, HOME_RAIL_LIMIT);
}

export type HomeFeedRails = {
  featured: Property[];
  newThisWeek: Property[];
  mostSaved: Property[];
  mostViewed: Property[];
  shortletsToBook: Property[];
};

export async function loadHomeFeedRails(input: {
  context: DiscoveryContext;
  fallbackListings: Property[];
}): Promise<HomeFeedRails> {
  const fallbackListings = dedupeById(input.fallbackListings);
  const marketCountryCode = input.context.profileJurisdiction ?? null;
  const shortletCity = input.context.profileCity ?? fallbackListings[0]?.city ?? null;

  const [featuredRaw, newRaw, mostSavedRaw, mostViewedRaw, shortletsRaw] = await Promise.all([
    getFeaturedHomes({ context: input.context, limit: HOME_RAIL_LIMIT }),
    getNewHomes({ context: input.context, days: 7, limit: HOME_RAIL_LIMIT }),
    getMostSavedHomes({
      context: input.context,
      limit: HOME_RAIL_LIMIT,
      marketCountryCode,
    }),
    getMostViewedHomes({
      context: input.context,
      limit: HOME_RAIL_LIMIT,
      marketCountryCode,
    }),
    getShortletHomes({
      context: input.context,
      city: shortletCity,
      limit: HOME_RAIL_LIMIT,
    }),
  ]);

  return {
    featured: chooseRailItems(featuredRaw, fallbackListings),
    newThisWeek: chooseRailItems(newRaw, fallbackListings),
    mostSaved: chooseRailItems(mostSavedRaw, fallbackListings),
    mostViewed: chooseRailItems(mostViewedRaw, fallbackListings),
    shortletsToBook: chooseRailItems(shortletsRaw, fallbackListings),
  };
}
