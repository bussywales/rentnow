import type { CommercialLayoutType, ListingType } from "@/lib/types";
import { isCommercialListingType, isNonRoomListingType, isResidentialListingType } from "@/lib/properties/listing-types";

export const COMMERCIAL_LAYOUT_TYPE_OPTIONS = [
  { value: "open_plan", label: "Open plan" },
  { value: "partitioned", label: "Partitioned" },
  { value: "multi_room", label: "Multi-room" },
  { value: "suite", label: "Suite" },
  { value: "shop_floor", label: "Shop floor" },
  { value: "warehouse", label: "Warehouse" },
  { value: "mixed", label: "Mixed layout" },
] as const;

type CommercialSpaceShape = {
  listing_type?: ListingType | null;
  bedrooms?: number | null;
  commercial_layout_type?: string | null;
  enclosed_rooms?: number | null;
  bathrooms?: number | null;
  size_value?: number | null;
  size_unit?: "sqm" | "sqft" | null;
};

function labelFromOptions<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string | null | undefined
) {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

export function formatCommercialLayoutType(
  value: CommercialLayoutType | string | null | undefined
) {
  return labelFromOptions(COMMERCIAL_LAYOUT_TYPE_OPTIONS, value);
}

export function countEnclosedRoomsLabel(value: number | null | undefined) {
  if (typeof value !== "number" || value < 0) return null;
  return value === 1 ? "1 enclosed room" : `${value} enclosed rooms`;
}

export function getSpatialModelForListingType(type?: ListingType | null) {
  if (isResidentialListingType(type)) return "residential";
  if (isCommercialListingType(type)) return "commercial";
  if (isNonRoomListingType(type)) return "land";
  return "shared";
}

export function buildCommercialSpaceFacts(property: CommercialSpaceShape) {
  const facts: Array<{ key: "layout" | "enclosed_rooms" | "bathrooms"; label: string; value: string }> = [];

  const layout = formatCommercialLayoutType(property.commercial_layout_type);
  if (layout) {
    facts.push({ key: "layout", label: "Layout", value: layout });
  }

  const enclosedRooms = countEnclosedRoomsLabel(property.enclosed_rooms);
  if (enclosedRooms) {
    facts.push({ key: "enclosed_rooms", label: "Enclosed rooms", value: enclosedRooms });
  }

  if (typeof property.bathrooms === "number" && property.bathrooms > 0) {
    facts.push({
      key: "bathrooms",
      label: "Bathrooms",
      value: property.bathrooms === 1 ? "1 bathroom" : `${property.bathrooms} bathrooms`,
    });
  }

  return facts;
}

export function normalizeSpatialFieldsForListingType<T extends CommercialSpaceShape>(
  property: T
): T {
  const model = getSpatialModelForListingType(property.listing_type);

  if (model === "commercial") {
    return {
      ...property,
      bedrooms: 0,
    };
  }

  if (model === "land") {
    return {
      ...property,
      bedrooms: 0,
      bathrooms: 0,
      commercial_layout_type: null,
      enclosed_rooms: null,
    };
  }

  if (model === "residential") {
    return {
      ...property,
      commercial_layout_type: null,
      enclosed_rooms: null,
    };
  }

  return property;
}
