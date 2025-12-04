import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapClient } from "@/components/properties/PropertyMapClient";
import { Button } from "@/components/ui/Button";
import { mockProperties } from "@/lib/mock";
import { searchProperties } from "@/lib/search";
import type { ParsedSearchFilters, Property } from "@/lib/types";
type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export const dynamic = "force-dynamic";

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
  let properties: Property[] = [];
  const hubs = [
    { city: "Lagos", label: "Lagos Island" },
    { city: "Nairobi", label: "Nairobi" },
    { city: "Accra", label: "Accra" },
    { city: "Dakar", label: "Dakar" },
  ];

  try {
    // Prefer API to avoid build-time staleness
    const apiRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/properties`, {
      cache: "no-store",
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      const typed =
        (json.properties as Array<Property & { property_images?: Array<{ id: string; image_url: string }> }>) ||
        [];
      properties =
        typed.map((row) => ({
          ...row,
          images: row.property_images?.map((img) => ({
            id: img.id,
            image_url: img.image_url,
          })),
        })) || [];
    }

    // Apply filters server-side via searchProperties if present
    if (properties.length && Object.values(filters).some((v) => v !== null && v !== undefined && v !== "")) {
      const { data, error } = await searchProperties(filters);
      if (!error && data) {
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
    }
  } catch (err) {
    console.warn("Supabase not configured; using mock data", err);
  }

  if (!properties.length) {
    properties = mockProperties;
  }

  if (!properties.length) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4">
        <h1 className="text-2xl font-semibold text-slate-900">No properties found</h1>
        <p className="text-sm text-slate-600">
          We could not find any listings for these filters. Clear your search or jump into the demo
          listings below.
        </p>
        <div className="flex flex-wrap gap-3">
          {mockProperties.slice(0, 3).map((property) => (
            <Link
              key={property.id}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-sky-700 hover:border-sky-300"
              href={`/properties/${property.id}`}
            >
              {property.title}
            </Link>
          ))}
        </div>
        <Link href="/properties" className="text-sky-700 font-semibold">
          Reset filters
        </Link>
      </div>
    );
  }

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

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Popular hubs
        </p>
        {hubs.map((hub) => (
          <Link
            key={hub.city}
            href={`/properties?city=${encodeURIComponent(hub.city)}`}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
          >
            {hub.label}
          </Link>
        ))}
        <Link
          href="/properties"
          className="rounded-full border border-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-100"
        >
          Clear
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
