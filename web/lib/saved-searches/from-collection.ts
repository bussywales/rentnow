import type { Property, RentalType } from "@/lib/types";
import { normalizeSavedSearchFilters } from "@/lib/saved-searches/matching";

function mostFrequent(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let winner: string | null = null;
  let winnerCount = 0;
  for (const [value, count] of counts) {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }

  return winner;
}

function allSame<T extends string | number | boolean>(values: T[]) {
  if (!values.length) return null;
  const first = values[0];
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] !== first) return null;
  }
  return first;
}

function clampCurrencyValue(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

export function buildSavedSearchNameFromCollection(collectionTitle: string | null | undefined) {
  const trimmed = typeof collectionTitle === "string" ? collectionTitle.trim() : "";
  if (!trimmed) return "Shared shortlist search";
  const next = `Shortlist: ${trimmed}`;
  return next.length > 120 ? `${next.slice(0, 117)}...` : next;
}

export function deriveSavedSearchFiltersFromCollectionListings(listings: Property[]) {
  if (!listings.length) return {} as Record<string, unknown>;

  const cities = listings
    .map((listing) => (typeof listing.city === "string" ? listing.city.trim() : ""))
    .filter(Boolean);
  const countryCodes = listings
    .map((listing) =>
      typeof listing.country_code === "string" ? listing.country_code.trim().toUpperCase() : ""
    )
    .filter(Boolean);
  const prices = listings
    .map((listing) => clampCurrencyValue(Number(listing.price)))
    .filter((value): value is number => value !== null);
  const bedrooms = listings
    .map((listing) => clampCurrencyValue(Number(listing.bedrooms)))
    .filter((value): value is number => value !== null);
  const rentalTypes = listings
    .map((listing) => listing.rental_type)
    .filter((value): value is RentalType => value === "short_let" || value === "long_term");
  const listingIntents = listings
    .map((listing) => listing.listing_intent)
    .filter((value): value is "rent" | "buy" => value === "rent" || value === "buy");
  const listingTypes = listings
    .map((listing) =>
      typeof listing.listing_type === "string" ? listing.listing_type.trim() : ""
    )
    .filter(Boolean);
  const furnishedValues = listings
    .map((listing) => listing.furnished)
    .filter((value): value is boolean => typeof value === "boolean");

  const derived: Record<string, unknown> = {};

  const city = mostFrequent(cities);
  if (city) derived.city = city;

  const countryCode = mostFrequent(countryCodes);
  if (countryCode) derived.country_code = countryCode;

  if (prices.length) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    derived.minPrice = minPrice;
    derived.maxPrice = maxPrice;
  }

  if (bedrooms.length) {
    const sameBedrooms = allSame(bedrooms);
    if (typeof sameBedrooms === "number") {
      derived.bedrooms = sameBedrooms;
      derived.bedroomsMode = "exact";
    } else {
      derived.bedrooms = Math.min(...bedrooms);
      derived.bedroomsMode = "minimum";
    }
  }

  const rentalType = allSame(rentalTypes);
  if (rentalType === "short_let" || rentalType === "long_term") {
    derived.rentalType = rentalType;
  }

  const listingIntent = allSame(listingIntents);
  if (listingIntent === "rent" || listingIntent === "buy") {
    derived.intent = listingIntent;
  } else {
    derived.intent = "all";
  }

  const listingType = allSame(listingTypes);
  if (typeof listingType === "string" && listingType) {
    derived.propertyType = listingType;
  }

  const furnished = allSame(furnishedValues);
  if (typeof furnished === "boolean") {
    derived.furnished = furnished;
  }

  return normalizeSavedSearchFilters(derived);
}
