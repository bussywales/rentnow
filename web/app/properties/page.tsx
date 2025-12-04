import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapClient } from "@/components/properties/PropertyMapClient";
import { Button } from "@/components/ui/Button";
import { getSiteUrl } from "@/lib/env";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
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
  const hasFilters = Object.values(filters).some(
    (v) => v !== null && v !== undefined && v !== ""
  );
  const baseUrl = getSiteUrl();
  const apiUrl = `${baseUrl}/api/properties`;
  let properties: Property[] = [];
  let fetchError: string | null = null;
  const hubs = [
    { city: "Lagos", label: "Lagos Island" },
    { city: "Nairobi", label: "Nairobi" },
    { city: "Accra", label: "Accra" },
    { city: "Dakar", label: "Dakar" },
  ];

  try {
    const apiRes = await fetch(apiUrl, {
      cache: "no-store",
    });
    if (!apiRes.ok) {
      fetchError = `API responded with ${apiRes.status}`;
    } else {
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
      console.log("[properties] fetched via API", {
        count: properties.length,
        apiUrl,
        sample: properties[0]?.title,
      });
    }

    if (hasFilters && hasServerSupabaseEnv()) {
      const { data, error } = await searchProperties(filters);
      if (error) {
        fetchError = error.message;
      }
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
        console.log("[properties] filtered via Supabase", {
          count: properties.length,
          filters,
        });
      }
    } else if (hasFilters) {
      fetchError = fetchError ?? "Supabase env vars missing; live filtering is unavailable.";
    }
  } catch (err) {
    console.error("[properties] fetch failed", err);
    fetchError = err instanceof Error ? err.message : "Unknown error while fetching properties";
  }

  if (!properties.length && !fetchError) {
    fetchError = "API returned 0 properties";
  }

  if (!properties.length) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4">
        <h1 className="text-2xl font-semibold text-slate-900">No properties found</h1>
        <p className="text-sm text-slate-600">
          We couldn&apos;t load live listings right now.
          {hasFilters
            ? " Try adjusting your filters or clearing the search."
            : " Check the API response and Supabase connection."}
        </p>
        {fetchError && (
          <p className="text-xs text-amber-700">Error: {fetchError}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href="/properties" className="text-sky-700 font-semibold">
            Reset filters
          </Link>
          <Link href="/dashboard/properties/new" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
            List your first property
          </Link>
        </div>
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
