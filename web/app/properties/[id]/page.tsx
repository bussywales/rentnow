export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { MessageThreadClient } from "@/components/messaging/MessageThreadClient";
import { PropertyMapToggle } from "@/components/properties/PropertyMapToggle";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { SaveButton } from "@/components/properties/SaveButton";
import { PropertyTrustCues } from "@/components/properties/PropertyTrustCues";
import { PublicPropertyShareButton } from "@/components/properties/PublicPropertyShareButton";
import { RequestViewingCtaSection } from "@/components/viewings/RequestViewingCtaSection";
import { TrustIdentityPill } from "@/components/trust/TrustIdentityPill";
import { PropertySharePanel } from "@/components/properties/PropertySharePanel";
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
import { getFastResponderByHostIds } from "@/lib/trust/fast-responder.server";
import { buildTrustCues } from "@/lib/trust-cues";
import { getTenantPlanForTier } from "@/lib/plans";
import type { Profile, Property } from "@/lib/types";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { orderImagesWithCover } from "@/lib/properties/images";
import { resolveBackHref } from "@/lib/properties/back-href";
import { derivePhotoTrust } from "@/lib/properties/photo-trust";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { isListingExpired } from "@/lib/properties/expiry";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import { getListingPopularitySignals, type ListingPopularitySignal } from "@/lib/properties/popularity.server";
import {
  derivePublicAdvertiserName,
  isPublicAdvertiserRole,
  resolvePublicAdvertiserHref,
} from "@/lib/advertisers/public-profile";
import { isSaleIntent, normalizeListingIntent } from "@/lib/listing-intents";
import { getMarketSettings } from "@/lib/market/market.server";
import {
  MARKET_COOKIE_NAME,
  readCookieValueFromHeader,
  resolveMarketFromRequest,
} from "@/lib/market/market";
import { ShortletBookingWidget } from "@/components/properties/ShortletBookingWidget";
import { isShortletProperty } from "@/lib/shortlet/discovery";
import {
  formatShortletCancellationLabel,
  resolveShortletCancellationPolicy,
} from "@/lib/shortlet/cancellation";
import { CtaHashAnchorClient } from "@/components/properties/CtaHashAnchorClient";

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

async function getProperty(
  id: string | undefined,
  options?: { source?: string | null; requestHeaders?: Headers }
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
  const requestUrl = new URL(apiUrl);
  if (options?.source) {
    requestUrl.searchParams.set("source", options.source);
  }
  let apiError: string | null = null;

  try {
    const res = await fetch(requestUrl.toString(), {
      headers: options?.requestHeaders,
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
          apiUrl: requestUrl.toString(),
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
          apiUrl: requestUrl.toString(),
        };
      }
    }
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Unknown error while fetching property";
  }

  if (DEV_MOCKS) {
    const fallback = mockProperties.find((item) => item.id === cleanId) ?? null;
    if (fallback) {
      return { property: fallback, error: null, apiUrl: requestUrl.toString() };
    }
  }

  return { property: null, error: apiError ?? "Listing not found", apiUrl: requestUrl.toString() };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await extractId(params);
  const { property } = await getProperty(id);
  const baseUrl = await getCanonicalBaseUrl();
  const headerList = await headers();
  const market = resolveMarketFromRequest({
    headers: headerList,
    cookieValue: readCookieValueFromHeader(headerList.get("cookie"), MARKET_COOKIE_NAME),
    appSettings: await getMarketSettings(),
  });

  if (!property) {
    const canonicalPath = `/properties/${id ?? ""}`;
    const canonicalUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;
    return {
      title: "Listing not found | PropatyHub",
      description: "This listing is unavailable.",
      alternates: { canonical: canonicalUrl },
    };
  }

  const title = `${property.title} | ${property.city}${property.neighbourhood ? ` - ${property.neighbourhood}` : ""}`;
  const description =
    property.description ||
    `Discover ${property.title} in ${property.city}. ${property.bedrooms} bed, ${property.bathrooms} bath ${property.rental_type === "short_let" ? "short-let" : "rental"} for ${formatPriceValue(property.currency, property.price, { marketCurrency: market.currency })}.`;
  const imageUrl = property.cover_image_url || property.images?.[0]?.image_url;

  const canonicalPath = `/properties/${property.id}`;
  const canonicalUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;
  const isDemoListing = !!property.is_demo;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      siteName: "PropatyHub",
      images: imageUrl ? [{ url: imageUrl, alt: property.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    ...(isDemoListing
      ? {
          robots: {
            index: false,
            follow: false,
          },
        }
      : {}),
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
  const market = resolveMarketFromRequest({
    headers: headerList,
    cookieValue: readCookieValueFromHeader(headerList.get("cookie"), MARKET_COOKIE_NAME),
    appSettings: await getMarketSettings(),
  });
  const backHref = resolveBackHref(resolvedSearchParams, headerList.get("referer"));
  const sourceParam = getSearchParamValue(resolvedSearchParams, "source") ?? null;
  const forwardedHeaders = new Headers();
  const cookieHeader = headerList.get("cookie");
  const userAgentHeader = headerList.get("user-agent");
  const forwardedFor = headerList.get("x-forwarded-for");
  if (cookieHeader) forwardedHeaders.set("cookie", cookieHeader);
  if (userAgentHeader) forwardedHeaders.set("user-agent", userAgentHeader);
  if (forwardedFor) forwardedHeaders.set("x-forwarded-for", forwardedFor);
  let property: Property | null = null;
  let fetchError: string | null = null;
  let apiUrl: string | null = null;
  try {
    const result = await getProperty(id, {
      source: sourceParam,
      requestHeaders: forwardedHeaders,
    });
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
  let isAdmin = false;
  let isHost = false;
  let currentUser: Profile | null = null;
  let hostTrust: TrustMarkerState | null = null;
  let fastResponder = false;
  let similar: Property[] = [];
  let similarTrustSnapshots: Record<string, TrustMarkerState> = {};
  let similarSocialProof: Record<string, ListingPopularitySignal> = {};
  let hostProfileName: string | null = null;
  let hostProfileCity: string | null = null;
  let hostProfileIsPublicAdvertiser = false;
  let hostProfileHref: string | null = null;
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
          const role = normalizeRole(profile?.role ?? null);
          isTenant = role === "tenant";
          isAdmin = role === "admin";
          isHost = role === "landlord" || role === "agent";
          currentUser = {
            id: user.id,
            role: role ?? null,
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
        const nowIso = new Date().toISOString();
        const includeDemoListingsInSimilar = includeDemoListingsForViewer({
          viewerRole: isAdmin ? "admin" : null,
        });
        let similarQuery = supabase
          .from("properties")
          .select("*, property_images(id, image_url, position, created_at)")
          .eq("city", property.city)
          .eq("rental_type", property.rental_type)
          .eq("status", "live")
          .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
          .neq("id", property.id)
          .order("created_at", { ascending: false })
          .limit(8);
        if (!includeDemoListingsInSimilar) {
          similarQuery = similarQuery.eq("is_demo", false);
        }
        const { data: similarRaw } = await similarQuery;

        let similarResults: Array<
          Property & { property_images?: Array<{ id: string; image_url: string }> }
        > = [];

        if (Array.isArray(similarRaw)) {
          similarResults = similarRaw as typeof similarResults;
        } else {
          // fallback fetch without rental_type if no result
          let fallbackQuery = supabase
            .from("properties")
            .select("*, property_images(id, image_url, position, created_at)")
            .eq("city", property.city)
            .eq("status", "live")
            .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
            .neq("id", property.id)
            .order("created_at", { ascending: false })
            .limit(8);
          if (!includeDemoListingsInSimilar) {
            fallbackQuery = fallbackQuery.eq("is_demo", false);
          }
          const { data: fallback } = await fallbackQuery;
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
      try {
        const { data: hostProfile } = await supabase
          .from("profiles")
          .select("role, display_name, full_name, business_name, city, public_slug")
          .eq("id", property.owner_id)
          .maybeSingle();
        if (hostProfile && isPublicAdvertiserRole(hostProfile.role)) {
          hostProfileIsPublicAdvertiser = true;
          hostProfileName = derivePublicAdvertiserName(hostProfile);
          hostProfileCity = hostProfile.city ?? null;
          hostProfileHref =
            resolvePublicAdvertiserHref({
              advertiserId: property.owner_id,
              publicSlug: hostProfile.public_slug ?? null,
            }) ?? `/u/${property.owner_id}`;
        }
      } catch (err) {
        console.warn("[property-detail] host profile fetch failed", err);
        hostProfileName = null;
        hostProfileCity = null;
        hostProfileIsPublicAdvertiser = false;
        hostProfileHref = null;
      }
      try {
        const fastMap = await getFastResponderByHostIds({
          supabase,
          hostIds: [property.owner_id],
        });
        fastResponder = fastMap[property.owner_id] ?? false;
      } catch (err) {
        console.warn("[property-detail] fast responder lookup failed", err);
        fastResponder = false;
      }
      try {
        const similarOwnerIds = Array.from(new Set(similar.map((item) => item.owner_id).filter(Boolean)));
        const similarIds = similar.map((item) => item.id).filter(Boolean);
        if (similarOwnerIds.length) {
          similarTrustSnapshots = await fetchTrustPublicSnapshots(supabase, similarOwnerIds);
        }
        if (similarIds.length) {
          similarSocialProof = await getListingPopularitySignals({
            client: supabase,
            listingIds: similarIds,
          });
        }
      } catch (err) {
        console.warn("[property-detail] similar trust signal lookup failed", err);
        similarTrustSnapshots = {};
        similarSocialProof = {};
      }
    } catch (err) {
      console.warn("[property-detail] supabase client unavailable", err);
      isSaved = false;
      similar = [];
      similarTrustSnapshots = {};
      similarSocialProof = {};
      hostProfileName = null;
      hostProfileCity = null;
      hostProfileIsPublicAdvertiser = false;
      hostProfileHref = null;
    }
  }

  const locationLabel = formatLocationLabel(property.city, property.neighbourhood);
  const priceValue = formatPriceValue(property.currency, property.price, {
    marketCurrency: market.currency,
  });
  const cadence = formatCadence(property.rental_type, property.rent_period);
  const listingTypeLabel = formatListingType(property.listing_type);
  const listingIntent = normalizeListingIntent(property.listing_intent) ?? "rent_lease";
  const isSaleListing = isSaleIntent(listingIntent);
  const isShortletListing = isShortletProperty(property);
  const shortletCancellationLabel = isShortletListing
    ? formatShortletCancellationLabel(
        resolveShortletCancellationPolicy({
          shortlet_settings: property.shortlet_settings ?? null,
        })
      )
    : null;
  const isFeaturedActive =
    !!property.is_featured &&
    (!property.featured_until || Date.parse(property.featured_until) > Date.now());
  const isGuest = !currentUser;
  const showPublicActions = isGuest || isTenant;
  const isExpired = isListingExpired(property);
  const showExpiredPublic = await getAppSettingBool(
    "show_expired_listings_public",
    false
  );
  const viewerCanBypassExpired =
    isAdmin || (isHost && currentUser?.id === property.owner_id);
  const expiredReadOnly = isExpired && !viewerCanBypassExpired;
  const sharedFlag = getSearchParamValue(resolvedSearchParams, "shared");
  const redirectPath = sharedFlag
    ? `/properties/${property.id}?shared=${encodeURIComponent(sharedFlag)}`
    : `/properties/${property.id}`;
  const loginRedirect = `/auth/login?reason=auth&redirect=${encodeURIComponent(redirectPath)}`;
  const sizeLabel =
    typeof property.size_value === "number" && property.size_value > 0
      ? formatSizeLabel(property.size_value, property.size_unit)
      : null;
  const depositLabel =
    typeof property.deposit_amount === "number" && property.deposit_amount > 0
      ? formatPriceValue(
          property.deposit_currency || property.currency,
          property.deposit_amount,
          { marketCurrency: market.currency }
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
  const hostTrustCues = buildTrustCues({
    markers: hostTrust,
    fastResponder,
    createdAt: property.created_at,
  });
  const showTrustSignals = !!hostTrust || hostTrustCues.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8 px-4">
      <CtaHashAnchorClient targetId="cta" topOffsetPx={104} />
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-sky-700"
        >
          <span aria-hidden>{"<-"}</span>
          Back to results
        </Link>
      )}
      {expiredReadOnly && showExpiredPublic && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">This listing has expired and is no longer available.</p>
          <p className="mt-1 text-amber-800">Details are view-only. Contact and enquiry actions are disabled.</p>
        </div>
      )}
      {property && !property.is_demo && (
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
      <div className="grid min-w-0 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 min-w-0">
          <PropertyGallery
            images={property.images || []}
            title={property.title}
            isDemo={!!property.is_demo}
          />
        </div>
        <div className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {isSaleListing
              ? "For sale"
              : isShortletListing || property.rental_type === "short_let"
                ? "Short-let"
                : "Long-term"}
          </p>
          {isFeaturedActive && (
            <div className="inline-flex w-fit items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Featured by PropatyHub
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{property.title}</h1>
            {property.is_demo && (
              <span className="property-demo-badge inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                Demo listing
              </span>
            )}
          </div>
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
          <div className="mt-3 flex flex-wrap gap-2">
            <SaveButton propertyId={property.id} initialSaved={isSaved} />
            <PublicPropertyShareButton
              propertyId={property.id}
              surface="property_detail"
              variant="button"
            />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
        <div className="min-w-0 space-y-4">
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
                {hostProfileIsPublicAdvertiser && property.owner_id ? (
                  <Link
                    href={hostProfileHref ?? `/u/${property.owner_id}`}
                    className="text-xs font-semibold text-slate-700 underline-offset-4 hover:text-sky-700 hover:underline"
                  >
                    {hostProfileName || "View advertiser profile"}
                  </Link>
                ) : (
                  <p className="text-xs text-slate-600 break-all">
                    {property.owner_id ? `Host ID: ${property.owner_id}` : "Demo host"}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Based in {hostProfileCity || property.city}
                </p>
              </div>
            </div>
            {showTrustSignals && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Trust signals
                </p>
                {hostTrust && <TrustIdentityPill markers={hostTrust} />}
                {hostTrustCues.length > 0 && (
                  <PropertyTrustCues
                    markers={hostTrust}
                    fastResponder={fastResponder}
                    createdAt={property.created_at}
                  />
                )}
                {hostTrust?.trust_updated_at && (
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
          {showPublicActions && !expiredReadOnly && isShortletListing && (
            <ShortletBookingWidget
              propertyId={property.id}
              listingTitle={property.title}
              isAuthenticated={!isGuest}
              loginHref={loginRedirect}
              cancellationLabel={shortletCancellationLabel ?? undefined}
            />
          )}
          {showPublicActions && !expiredReadOnly && !isSaleListing && !isShortletListing && (
            <div id="cta" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Viewing requests</h3>
              </div>
              <div className="mt-3">
                {isGuest ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Ready to view this home?
                    </p>
                    <p className="text-sm text-slate-600">
                      Log in to request a viewing and keep everything in one place.
                    </p>
                    <Link href={loginRedirect}>
                      <Button>Request viewing</Button>
                    </Link>
                  </div>
                ) : (
                  <RequestViewingCtaSection
                    propertyId={property.id}
                    timezoneLabel={timezoneText}
                  />
                )}
              </div>
            </div>
          )}
          {showPublicActions && !expiredReadOnly && isSaleListing && (
            <div id="cta" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Enquire to buy</h3>
              </div>
              <div className="mt-3">
                {isGuest ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Ready to buy?</p>
                    <p className="text-sm text-slate-600">
                      Log in to send a verified enquiry to the host or agent.
                    </p>
                    <Link href={loginRedirect}>
                      <Button>Enquire to buy</Button>
                    </Link>
                  </div>
                ) : (
                  <RequestViewingCtaSection
                    propertyId={property.id}
                    timezoneLabel={timezoneText}
                    listingIntent="buy"
                  />
                )}
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
          {currentUser && (isAdmin || (isHost && currentUser.id === property.owner_id)) && (
            <PropertySharePanel propertyId={property.id} />
          )}
          {!expiredReadOnly ? (
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
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Contact landlord/agent</h3>
              <p className="mt-1 text-sm text-slate-600">
                This listing has expired, so contact and enquiry actions are disabled.
              </p>
            </div>
          )}
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
                trustMarkers={similarTrustSnapshots[item.owner_id]}
                socialProof={similarSocialProof[item.id] ?? null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
