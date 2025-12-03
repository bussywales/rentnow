import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapClient } from "@/components/properties/PropertyMapClient";
import { Button } from "@/components/ui/Button";
import { mockProperties } from "@/lib/mock";
import { searchProperties } from "@/lib/search";
import type { ParsedSearchFilters, Property } from "@/lib/types";
type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

function parseFilters(params: Props["searchParams"]): ParsedSearchFilters {
  return {
    city: params.city ? String(params.city) : null,
    minPrice: params.minPrice ? Number(params.minPrice) : null,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : null,
    currency: params.currency ? String(params.currency) : null,
    bedrooms: params.bedrooms ? Number(params.bedrooms) : null,
    rentalType: params.rentalType
      ? (params.rentalType as ParsedSearchFilters["rentalType"])
      : null,
    furnished:
      params.furnished === "true" ? true : params.furnished === "false" ? false : null,
    amenities: params.amenities
      ? String(params.amenities)
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [],
  };
}

export default async function PropertiesPage({ searchParams }: Props) {
  const filters = parseFilters(searchParams);
  let properties: Property[] = mockProperties;

  try {
    const { data, error } = await searchProperties(filters);
    if (error) {
      console.warn("Falling back to mock properties", error.message);
    } else if (data) {
      const typed = data as Array<
        Property & { property_images?: Array<{ id: string; image_url: string }> }
      >;
      properties =
        typed?.map((row) => ({
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

  if (!properties.length) return notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-600">
            Showing {properties.length} listings
            {filters.city ? ` in ${filters.city}` : ""}.
          </p>
        </div>
        <Link href="/dashboard/properties/new">
          <Button variant="secondary">List a property</Button>
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            href={`/properties/${property.id}`}
          />
        ))}
      </div>

      <PropertyMapClient properties={properties.slice(0, 12)} height="420px" />
    </div>
  );
}
