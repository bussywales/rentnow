import type { ListingType } from "@/lib/types";

const RESIDENTIAL_LISTING_TYPES = new Set<ListingType>([
  "apartment",
  "house",
  "duplex",
  "bungalow",
  "studio",
  "room",
  "student",
  "hostel",
  "condo",
]);

const COMMERCIAL_LISTING_TYPES = new Set<ListingType>(["office", "shop"]);

const NON_ROOM_LISTING_TYPES = new Set<ListingType>(["land"]);

export function isResidentialListingType(type?: ListingType | null): boolean {
  if (!type) return false;
  return RESIDENTIAL_LISTING_TYPES.has(type);
}

export function isCommercialListingType(type?: ListingType | null): boolean {
  if (!type) return false;
  return COMMERCIAL_LISTING_TYPES.has(type);
}

export function isNonRoomListingType(type?: ListingType | null): boolean {
  if (!type) return false;
  return NON_ROOM_LISTING_TYPES.has(type);
}

export function requiresRooms(type?: ListingType | null): boolean {
  return isResidentialListingType(type);
}
