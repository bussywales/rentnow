export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { MessageThreadClient } from "@/components/messaging/MessageThreadClient";
import { PropertyMapToggle } from "@/components/properties/PropertyMapToggle";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { SaveButton } from "@/components/properties/SaveButton";
import { RequestViewingCtaSection } from "@/components/viewings/RequestViewingCtaSection";
import { TrustBadges } from "@/components/trust/TrustBadges";
import { TrustReliability } from "@/components/trust/TrustReliability";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProfile } from "@/lib/auth";
import { DEV_MOCKS, getApiBaseUrl, getCanonicalBaseUrl, getEnvPresence } from "@/lib/env";
import { mockProperties } from "@/lib/mock";
import {
  formatCadence,
  formatListingType,
  formatLocationLabel,
  formatPriceValue,
  formatSizeLabel,
} from "@/lib/property-discovery";
import { getListingCta } from "@/lib/role-access";
import { normalizeRole } from "@/lib/roles";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import { getTenantPlanForTier } from "@/lib/plans";
import type { Profile, Property } from "@/lib/types";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { orderImagesWithCover } from "@/lib/properties/images";
import { derivePhotoTrust } from "@/lib/properties/photo-trust";
import { getAppSettingBool } from "@/lib/settings/app-settings";

type Params = { id?: string };
type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Params | Promise<Params>;
  searchParams?: SearchParams | Promise<SearchParams>;
};

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

function getSearchParamValue(
  params: SearchParams | undefined,
  key: string
): string | undefined {
  if (!params) return undefined;
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function resolveBackHref(
  params: SearchParams | undefined,
  referer: string | null
): string | null {
  const rawBack = getSearchParamValue(params, "back");
  if (rawBack) {
    try {
      const decoded = decodeURIComponent(rawBack);
      if (decoded.startsWith("/properties")) {
        return decoded;
      }
    } catch {
      if (rawBack.startsWith("/properties")) {
        return rawBack;
      }
    }
  }

  if (!referer) return null;
  try {
    const url = new URL(referer);
    if (url.pathname === "/properties") {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return null;
  }
  return null;
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
            images: orderImagesWithCover(
              data.cover_image_url,
              data.property_images?.map((img) => ({
                id: img.id || img.image_url,
                image_url: img.image_url,
                position: (img as { position?: number }).position,
                created_at: (img as { created_at?: string | null }).created_at ?? undefined,
                width: (img as { width?: number | null }).width ?? null,
                height: (img as { height?: number | null }).height ?? null,
                bytes: (img as { bytes?: number | null }).bytes ?? null,
                format: (img as { format?: string | null }).format ?? null,
                exif_has_gps: (img as { exif_has_gps?: boolean | null }).exif_has_gps ?? null,
                exif_captured_at:
                  (img as { exif_captured_at?: string | null }).exif_captured_at ?? null,
              }))
            ),
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
  const baseUrl = await getCanonicalBaseUrl();

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
  const imageUrl = property.cover_image_url || property.images?.[0]?.image_url;

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

export default async function PropertyDetail({ params, searchParams }: Props) {
  const envPresence = getEnvPresence();
  const supabaseReady = hasServerSupabaseEnv();
  const profile = supabaseReady ? await getProfile() : null;
  const listingCta = getListingCta(normalizeRole(profile?.role));
  const siteUrl = await getCanonicalBaseUrl();
  const id = await extractId(params);
  const resolvedSearchParams =
    searchParams &&
    (typeof (searchParams as Promise<SearchParams>).then === "function"
      ? await (searchParams as Promise<SearchParams>)
      : (searchParams as SearchParams));
  const headerList = await headers();
  const backHref = resolveBackHref(resolvedSearchParams, headerList.get("referer"));
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
    const showDiagnostics = process.env.NODE_ENV === "development";

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
              <Link
                href={listingCta.href}
                className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
              >
                {listingCta.label}
              </Link>
            </>
          }
          diagnostics={
            showDiagnostics
              ? {
                  apiUrl,
                  id,
                  supabaseReady,
                  fetchError,
                  env: envPresence,
                }
              : undefined
          }
        />
      </div>
    );
  }

  let isSaved = false;
  let isTenant = false;
  let isTenantPro = false;
  let currentUser: Profile | null = null;
  let hostTrust: TrustMarkerState | null = null;
  let similar: Property[] = [];
  if (hasServerSupabaseEnv()) {
    try {
      const supabase = await createServerSupabaseClient();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", user.id)
            .maybeSingle();
          isTenant = profile?.role === "tenant";
          currentUser = {
            id: user.id,
            role: profile?.role ?? null,
            full_name: profile?.full_name || user.email || "You",
          };

          const { data: planRow } = await supabase
            .from("profile_plans")
            .select("plan_tier, valid_until")
            .eq("profile_id", user.id)
            .maybeSingle();
          const validUntil = planRow?.valid_until ?? null;
          const expired =
            !!validUntil && Number.isFinite(Date.parse(validUntil)) && Date.parse(validUntil) < Date.now();
          const tenantPlan = getTenantPlanForTier(expired ? "free" : planRow?.plan_tier ?? "free");
          isTenantPro = isTenant && tenantPlan.tier === "tenant_pro";

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
          .select("*, property_images(id, image_url, position, created_at)")
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
            .select("*, property_images(id, image_url, position, created_at)")
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
            images: orderImagesWithCover(
              row.cover_image_url,
              row.property_images?.map((img: { id: string; image_url: string; position?: number; created_at?: string }) => ({
                id: img.id || img.image_url,
                image_url: img.image_url,
                position: img.position,
                created_at: img.created_at ?? undefined,
                width: (img as { width?: number | null }).width ?? null,
                height: (img as { height?: number | null }).height ?? null,
                bytes: (img as { bytes?: number | null }).bytes ?? null,
                format: (img as { format?: string | null }).format ?? null,
                exif_has_gps: (img as { exif_has_gps?: boolean | null }).exif_has_gps ?? null,
                exif_captured_at:
                  (img as { exif_captured_at?: string | null }).exif_captured_at ?? null,
              }))
            ),
          })) || [];
      } catch (err) {
        console.warn("[property-detail] personalization fetch failed", err);
        isSaved = false;
        similar = [];
      }

      try {
        const trustMap = await fetchTrustPublicSnapshots(supabase, [property.owner_id]);
        hostTrust = trustMap[property.owner_id] ?? null;
      } catch (err) {
        console.warn("[property-detail] trust snapshot fetch failed", err);
        hostTrust = null;
      }
    } catch (err) {
      console.warn("[property-detail] supabase client unavailable", err);
      isSaved = false;
      similar = [];
    }
  }

  const locationLabel = formatLocationLabel(property.city, property.neighbourhood);
  const priceValue = formatPriceValue(property.currency, property.price);
  const cadence = formatCadence(property.rental_type, property.rent_period);
  const listingTypeLabel = formatListingType(property.listing_type);
  const sizeLabel =
    typeof property.size_value === "number" && property.size_value > 0
      ? formatSizeLabel(property.size_value, property.size_unit)
      : null;
  const depositLabel =
    typeof property.deposit_amount === "number" && property.deposit_amount > 0
      ? formatPriceValue(
          property.deposit_currency || property.currency,
          property.deposit_amount
        )
      : null;
  const bathroomLabel =
    property.bathroom_type === "private"
      ? "Private bathroom"
      : property.bathroom_type === "shared"
        ? "Shared bathroom"
        : null;
  const showTenantPhotoTrust = await getAppSettingBool(
    "show_tenant_photo_trust_signals",
    false
  );
  const checkinSignal = (property as unknown as {
    checkin_signal?: { status?: string; bucket?: string | null; checkedInAt?: string | null };
  }).checkin_signal;
  const showTenantCheckinBadge = checkinSignal?.status === "recent_checkin";
  const photoTrust = showTenantPhotoTrust
    ? derivePhotoTrust(
        (property.images ?? []) as Array<
          Partial<{ exif_has_gps: boolean | null; exif_captured_at: string | null }>
        >
      )
    : { hasLocationMeta: false, recency: "unknown" as const };
  const petsLabel =
    typeof property.pets_allowed === "boolean"
      ? property.pets_allowed
        ? "Pets allowed"
        : "No pets"
      : null;
  const keyFacts = [
    listingTypeLabel ? { label: "Listing type", value: listingTypeLabel } : null,
    property.state_region ? { label: "State/Region", value: property.state_region } : null,
    property.country ? { label: "Country", value: property.country } : null,
    sizeLabel ? { label: "Size", value: sizeLabel } : null,
    typeof property.year_built === "number"
      ? { label: "Year built", value: String(property.year_built) }
      : null,
    bathroomLabel ? { label: "Bathroom", value: bathroomLabel } : null,
    depositLabel ? { label: "Security deposit", value: depositLabel } : null,
    petsLabel ? { label: "Pets", value: petsLabel } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const rentSubtext =
    property.rental_type === "short_let"
      ? "Short stay pricing"
      : property.rent_period === "yearly"
      ? "Annual rent"
      : property.rent_period === "monthly"
      ? "Monthly rent"
      : "Rent";
  const description =
    typeof property.description === "string" && property.description.trim().length > 0
      ? property.description
      : "This listing doesn't have a description yet. Contact the host for details.";
  const cityLabel =
    typeof property.city === "string" && property.city.trim().length > 0
      ? property.city
      : "property local";
  const timezoneText = `Times shown in ${cityLabel} time (${
    property.timezone || "Africa/Lagos"
  }).`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-sky-700"
        >
          <span aria-hidden>{"<-"}</span>
          Back to results
        </Link>
      )}
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
              addressRegion: property.state_region || property.neighbourhood || "",
              streetAddress: property.address || "",
              addressCountry: property.country || "NG",
            },
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
          <h1 className="text-2xl font-semibold text-slate-900">{property.title}</h1>
          <p className="text-sm text-slate-600">{locationLabel}</p>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-3xl font-semibold text-slate-900 flex flex-wrap items-baseline gap-1">
              {priceValue}
              {cadence && (
                <span className="text-sm font-normal text-slate-500 whitespace-nowrap">
                  {` / ${cadence}`}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">{rentSubtext}</p>
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
              {property.bedrooms} beds
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
              {property.bathrooms} baths
            </span>
            <span>{property.furnished ? "Furnished" : "Unfurnished"}</span>
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
          <div className="mt-3">
            <SaveButton propertyId={property.id} initialSaved={isSaved} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">About</h2>
          <p className="text-slate-700 leading-7">{description}</p>
          <PropertyMapToggle
            properties={[property]}
            height="320px"
            title="Location map"
            description="Show the exact location only when you need it."
            variant="inline"
          />
        </div>
        <div className="space-y-4">
          {keyFacts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Key facts</h3>
              <dl className="mt-3 space-y-2 text-sm text-slate-700">
                {keyFacts.map((fact) => (
                  <div key={fact.label} className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">{fact.label}</dt>
                    <dd className="font-semibold text-slate-900">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
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
            {hostTrust && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Verification
                </p>
                <TrustBadges markers={hostTrust} />
                <TrustReliability markers={hostTrust} />
                {hostTrust.trust_updated_at && (
                  <p className="text-xs text-slate-500">
                    Updated {new Date(hostTrust.trust_updated_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
          {isTenant && showTenantCheckinBadge && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Host check-in</h3>
              <p className="text-sm text-slate-700">Host checked in recently.</p>
              <p className="text-xs text-slate-500">
                Privacy-safe signal. No GPS coordinates are shown.
              </p>
            </div>
          )}
          {isTenant && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Viewing requests</h3>
              </div>
              <div className="mt-3">
                <RequestViewingCtaSection
                  propertyId={property.id}
                  timezoneLabel={timezoneText}
                />
              </div>
            </div>
          )}
          {isTenant && showTenantPhotoTrust && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Photo details</h3>
              <p className="text-xs text-slate-500">From the photo&apos;s camera data.</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Location metadata</span>
                  <span className="font-semibold text-slate-900">
                    {photoTrust.hasLocationMeta ? "Present" : "Not present"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Capture date</span>
                  <span className="font-semibold text-slate-900">
                    {photoTrust.recency === "recent"
                      ? "Captured recently"
                      : photoTrust.recency === "older"
                        ? "Captured a while ago"
                        : "Capture date unknown"}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Contact landlord/agent
              </h3>
              {isTenantPro && (
                <Button size="sm" variant="secondary">
                  Priority contact
                </Button>
              )}
            </div>
            {isTenant && !isTenantPro && (
              <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Upgrade to Tenant Pro for priority contact and instant alerts.{" "}
                <Link href="/tenant/billing#plans" className="font-semibold underline">
                  View plans
                </Link>
              </div>
            )}
            <MessageThreadClient
              propertyId={property.id}
              recipientId={property.owner_id}
              currentUser={currentUser}
            />
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Similar listings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {similar.map((item) => (
              <PropertyCard
                key={item.id}
                property={item}
                href={`/properties/${item.id}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
