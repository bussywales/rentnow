import Link from "next/link";
import type { Metadata } from "next";
import { MessageThreadClient } from "@/components/messaging/MessageThreadClient";
import { PropertyMapToggle } from "@/components/properties/PropertyMapToggle";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { SaveButton } from "@/components/properties/SaveButton";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { ViewingRequestForm } from "@/components/viewings/ViewingRequestForm";
import { DEV_MOCKS, getApiBaseUrl, getEnvPresence, getSiteUrl } from "@/lib/env";
import { mockProperties } from "@/lib/mock";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { id?: string };
type Props = { params: Params | Promise<Params> };

function normalizeId(id: string) {
  return decodeURIComponent(id).trim();
}

function extractId(raw: Params | Promise<Params>): Promise<string | undefined> {
  const maybePromise = raw as Promise<Params>;
  const isPromise = typeof (maybePromise as { then?: unknown }).then === "function";
  if (isPromise) {
    return maybePromise.then((p) => p?.id);
  }
  return Promise.resolve((raw as Params)?.id);
}

async function getProperty(
  id: string | undefined
): Promise<{ property: Property | null; error: string | null; apiUrl: string | null }> {
  if (!id) {
    return { property: null, error: "Invalid property id", apiUrl: null };
  }
  const cleanId = normalizeId(id);
  if (!cleanId || cleanId === "undefined" || cleanId === "null") {
    return { property: null, error: "Invalid property id", apiUrl: null };
  }
  const apiBaseUrl = await getApiBaseUrl();
  const apiUrl = `${apiBaseUrl}/api/properties/${cleanId}`;
  let apiError: string | null = null;

  try {
    const res = await fetch(apiUrl, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      let responseError: string | null = null;
      try {
        const body = await res.json();
        responseError = body?.error || null;
      } catch {
        responseError = null;
      }
      apiError = responseError
        ? `API ${res.status}: ${responseError}`
        : `API responded with ${res.status}`;
    } else {
      const json = await res.json();
      const data = json.property as
        | (Property & { property_images?: Array<{ id: string; image_url: string }> })
        | null;
      if (data) {
        console.log("[property detail] fetched via API", {
          id: cleanId,
          title: data.title,
          apiUrl,
        });
        return {
          property: {
            ...data,
            images: data.property_images?.map((img) => ({
              id: img.id,
              image_url: img.image_url,
            })),
          },
          error: null,
          apiUrl,
        };
      }
    }
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Unknown error while fetching property";
  }

  if (DEV_MOCKS) {
    const fallback = mockProperties.find((item) => item.id === cleanId) ?? null;
    if (fallback) {
      return { property: fallback, error: null, apiUrl };
    }
  }

  return { property: null, error: apiError ?? "Listing not found", apiUrl };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await extractId(params);
  const { property } = await getProperty(id);
  const baseUrl = (await getSiteUrl({ allowFallback: false })) || "";

  if (!property) {
    const canonicalPath = `/properties/${id ?? ""}`;
    const canonicalUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;
    return {
      title: "Listing not found | RENTNOW",
      description: "This listing is unavailable.",
      alternates: { canonical: canonicalUrl },
    };
  }

  const title = `${property.title} | ${property.city}${property.neighbourhood ? ` - ${property.neighbourhood}` : ""}`;
  const description =
    property.description ||
    `Discover ${property.title} in ${property.city}. ${property.bedrooms} bed, ${property.bathrooms} bath ${property.rental_type === "short_let" ? "short-let" : "rental"} for ${property.currency} ${property.price.toLocaleString()}.`;
  const imageUrl = property.images?.[0]?.image_url;

  const canonicalPath = `/properties/${property.id}`;
  const canonicalUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      siteName: "RENTNOW",
      images: imageUrl ? [{ url: imageUrl, alt: property.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function PropertyDetail({ params }: Props) {
  const envPresence = getEnvPresence();
  const supabaseReady = hasServerSupabaseEnv();
  const siteUrl = (await getSiteUrl({ allowFallback: false })) || "";
  const id = await extractId(params);
  let property: Property | null = null;
  let fetchError: string | null = null;
  let apiUrl: string | null = null;
  try {
    const result = await getProperty(id);
    property = result.property;
    fetchError = result.error;
    apiUrl = result.apiUrl;
  } catch (err) {
    console.error("Failed to load property detail", err);
    property = null;
    fetchError = err instanceof Error ? err.message : "Unknown error";
  }

  if (!property) {
    const retryHref = id ? `/properties/${id}` : "/properties";

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
        <ErrorState
          title="Listing not found"
          description="This listing isn't available right now. Verify the URL or check that the site URL env is set correctly for API calls."
          retryAction={
            <>
              <Link href={retryHref}>
                <Button size="sm" variant="secondary">
                  Retry
                </Button>
              </Link>
              <Link href="/properties" className="text-sky-700 font-semibold">
                Back to browse
              </Link>
              <Link href="/dashboard/properties/new" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
                List a property
              </Link>
            </>
          }
          diagnostics={{
            apiUrl,
            id,
            supabaseReady,
            fetchError,
            env: envPresence,
          }}
        />
      </div>
    );
  }

  let isSaved = false;
  let similar: Property[] = [];
  if (hasServerSupabaseEnv()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("saved_properties")
          .select("id")
          .eq("user_id", user.id)
          .eq("property_id", property.id)
          .maybeSingle();
        isSaved = !!data;
      }

      const priceFloor = property.price ? Math.max(0, property.price * 0.6) : null;
      const priceCeil = property.price ? property.price * 1.4 : null;
      const { data: similarRaw } = await supabase
        .from("properties")
        .select("*, property_images(id, image_url)")
        .eq("city", property.city)
        .eq("rental_type", property.rental_type)
        .neq("id", property.id)
        .order("created_at", { ascending: false })
        .limit(8);

      let similarResults: Array<
        Property & { property_images?: Array<{ id: string; image_url: string }> }
      > = [];

      if (Array.isArray(similarRaw)) {
        similarResults = similarRaw as typeof similarResults;
      } else {
        // fallback fetch without rental_type if no result
        const { data: fallback } = await supabase
          .from("properties")
          .select("*, property_images(id, image_url)")
          .eq("city", property.city)
          .neq("id", property.id)
          .order("created_at", { ascending: false })
          .limit(8);
        similarResults = (fallback as typeof similarResults) ?? [];
      }

      similarResults = similarResults
        .filter((row) => row.id !== property.id)
        .filter((row) => {
          if (priceFloor === null || priceCeil === null || !row.price) return true;
          return row.price >= priceFloor && row.price <= priceCeil;
        })
        .slice(0, 4);

      similar =
        similarResults?.map((row) => ({
          ...row,
          images: row.property_images?.map((img: { id: string; image_url: string }) => ({
            id: img.id,
            image_url: img.image_url,
          })),
        })) || [];
    } catch {
      isSaved = false;
      similar = [];
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
      {property && (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "RealEstateListing",
              name: property.title,
              description: property.description,
              url: siteUrl ? `${siteUrl}/properties/${property.id}` : `/properties/${property.id}`,
              image: property.images?.map((img) => img.image_url),
              datePosted: property.created_at,
              numberOfRooms: property.bedrooms,
              numberOfBedrooms: property.bedrooms,
              numberOfBathroomsTotal: property.bathrooms,
              address: {
                "@type": "PostalAddress",
                addressLocality: property.city,
                addressRegion: property.neighbourhood || "",
                streetAddress: property.address || "",
                addressCountry: "NG",
              },
              geo:
                typeof property.latitude === "number" && typeof property.longitude === "number"
                  ? { "@type": "GeoCoordinates", latitude: property.latitude, longitude: property.longitude }
                  : undefined,
              offers: {
                "@type": "Offer",
                price: property.price,
                priceCurrency: property.currency,
                availability: "https://schema.org/InStock",
                url: siteUrl ? `${siteUrl}/properties/${property.id}` : `/properties/${property.id}`,
              },
            }),
          }}
        />
      )}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <PropertyGallery images={property.images || []} title={property.title} />
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {property.rental_type === "short_let" ? "Short-let" : "Long-term"}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {property.title}
          </h1>
          <p className="text-sm text-slate-600">
            {property.city}
            {property.neighbourhood ? ` - ${property.neighbourhood}` : ""}
          </p>
          <div className="text-3xl font-semibold text-slate-900">
            {property.currency} {property.price.toLocaleString()}
            <span className="text-sm font-normal text-slate-500">
              {property.rental_type === "short_let" ? " / night" : " / month"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="flex items-center gap-1">
              <svg
                aria-hidden
                className="h-4 w-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M4 12V7a1 1 0 0 1 1-1h6v6" />
                <path d="M4 21v-3" />
                <path d="M20 21v-3" />
                <path d="M4 15h16v-3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" />
              </svg>
              {property.bedrooms}
            </span>
            <span className="flex items-center gap-1">
              <svg
                aria-hidden
                className="h-4 w-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M7 4a3 3 0 1 1 6 0v6" />
                <path d="M4 10h14" />
                <path d="M5 20h12" />
                <path d="M5 16h14v2a2 2 0 0 1-2 2H7a2 2 0 0 0-2-2Z" />
                <path d="M15 4h1" />
                <path d="M15 7h2" />
              </svg>
              {property.bathrooms}
            </span>
            {property.furnished && <span>Furnished</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(property.amenities || []).map((item) => (
              <span
                key={item}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>
          <SaveButton propertyId={property.id} initialSaved={isSaved} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">About</h2>
          <p className="text-slate-700 leading-7">{property.description}</p>
          <PropertyMapToggle
            properties={[property]}
            height="320px"
            title="Location map"
            description="Show the exact location only when you need it."
            variant="inline"
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                {property.city.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Hosted by</p>
                <p className="text-xs text-slate-600">
                  {property.owner_id ? `Host ID: ${property.owner_id}` : "Demo host"}
                </p>
                <p className="text-xs text-slate-500">Based in {property.city}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Request a viewing
            </h3>
            <ViewingRequestForm propertyId={property.id} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Contact landlord/agent
            </h3>
            <MessageThreadClient
              propertyId={property.id}
              recipientId={property.owner_id}
            />
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Similar listings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {similar.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
