import { NextResponse } from "next/server";
import { mockProperties } from "@/lib/mock";
import { searchProperties } from "@/lib/search";
import type { ParsedSearchFilters, Property } from "@/lib/types";

function parseFilters(request: Request): ParsedSearchFilters {
  const { searchParams } = new URL(request.url);
  return {
    city: searchParams.get("city"),
    minPrice: searchParams.get("minPrice")
      ? Number(searchParams.get("minPrice"))
      : null,
    maxPrice: searchParams.get("maxPrice")
      ? Number(searchParams.get("maxPrice"))
      : null,
    currency: searchParams.get("currency"),
    bedrooms: searchParams.get("bedrooms")
      ? Number(searchParams.get("bedrooms"))
      : null,
    rentalType: searchParams.get("rentalType") as ParsedSearchFilters["rentalType"],
    furnished:
      searchParams.get("furnished") === "true"
        ? true
        : searchParams.get("furnished") === "false"
        ? false
        : null,
    amenities: searchParams.get("amenities")
      ? String(searchParams.get("amenities"))
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [],
  };
}

export async function GET(request: Request) {
  const filters = parseFilters(request);
  let properties: Property[] = mockProperties;

  try {
    const { data, error } = await searchProperties(filters);
    if (!error && data) {
      const typed = data as Array<
        Property & { property_images?: Array<{ id: string; image_url: string }> }
      >;
      properties =
        typed.map((row) => ({
          ...row,
          images: row.property_images?.map((img) => ({
            id: img.id,
            image_url: img.image_url,
          })),
        })) || [];
    }
  } catch (err) {
    console.warn("Supabase not configured; using mock data", err);
  }

  return NextResponse.json({ properties });
}
