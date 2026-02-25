import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PublicSharedCollectionActions } from "@/components/saved/PublicSharedCollectionActions";
import { Button } from "@/components/ui/Button";
import { getCollectionBySlug } from "@/lib/collections/collections-registry";
import { buildCollectionResultsHref, getCollectionCards } from "@/lib/collections/collections-select";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import {
  buildCollectionShareUrl,
  getPublicCollectionByShareId,
  getPublicCollectionShareMetaByShareId,
  isPubliclyVisibleCollectionListing,
} from "@/lib/saved-collections.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import { getListingPopularitySignals } from "@/lib/properties/popularity.server";
import type { TrustMarkerState } from "@/lib/trust-markers";
import type { ListingSocialProof } from "@/lib/properties/listing-trust-badges";
import { BRAND_OG_IMAGE } from "@/lib/brand";
import { getCanonicalBaseUrl, getSiteUrl } from "@/lib/env";
import { deriveSavedSearchFiltersFromCollectionListings } from "@/lib/saved-searches/from-collection";
import { filtersToSearchParams, parseFiltersFromSavedSearch } from "@/lib/search-filters";

export const dynamic = "force-dynamic";

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

function deriveCollectionCity(cities: string[]) {
  if (!cities.length) return null;
  const counts = new Map<string, number>();
  for (const city of cities) {
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  let winner: string | null = null;
  let winnerCount = 0;
  for (const [city, count] of counts) {
    if (count > winnerCount) {
      winner = city;
      winnerCount = count;
    }
  }
  return winner;
}

export function buildCollectionShareMetadata(input: {
  shareId: string;
  baseUrl: string | null;
  title?: string | null;
  city?: string | null;
  imageUrl?: string | null;
}): Metadata {
  const canonicalPath = `/collections/${encodeURIComponent(input.shareId || "")}`;
  const canonicalUrl = input.baseUrl ? `${input.baseUrl}${canonicalPath}` : canonicalPath;
  const hasCollectionTitle = typeof input.title === "string" && input.title.trim().length > 0;
  const title = hasCollectionTitle
    ? `${input.title} · PropatyHub`
    : "Shared shortlist · PropatyHub";
  const description = input.city
    ? `Shared shortlist of homes in ${input.city} on PropatyHub.`
    : "Shared shortlist of homes on PropatyHub.";
  const imageUrl = input.imageUrl || BRAND_OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "PropatyHub",
      images: [{ url: imageUrl, alt: hasCollectionTitle ? input.title! : "PropatyHub" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const baseUrl = await getCanonicalBaseUrl();
  const generic = buildCollectionShareMetadata({
    shareId,
    baseUrl,
  });

  if (!shareId) {
    return generic;
  }

  const staticCollection = getCollectionBySlug(shareId);
  if (staticCollection) {
    const canonicalPath = `/collections/${encodeURIComponent(staticCollection.slug)}`;
    const canonicalUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;
    const title = `${staticCollection.title} · PropatyHub`;
    const description = staticCollection.description;
    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: "website",
        siteName: "PropatyHub",
        images: [{ url: BRAND_OG_IMAGE, alt: staticCollection.title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [BRAND_OG_IMAGE],
      },
    };
  }

  if (!isUuid(shareId) || !hasServiceRoleEnv()) return generic;

  try {
    const service = createServiceRoleClient();
    const collectionMeta = await getPublicCollectionShareMetaByShareId({
      supabase: service,
      shareId,
    });
    if (!collectionMeta) return generic;
    return buildCollectionShareMetadata({
      shareId,
      baseUrl,
      title: collectionMeta.title,
      city: collectionMeta.city,
      imageUrl: collectionMeta.imageUrl,
    });
  } catch {
    return generic;
  }
}

export default async function PublicCollectionPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  if (!shareId) notFound();

  const staticCollection = getCollectionBySlug(shareId);
  if (staticCollection) {
    const requestHeaders = await headers();
    const requestCookies = await cookies();
    const market = resolveMarketFromRequest({
      headers: requestHeaders,
      cookieValue: requestCookies.get(MARKET_COOKIE_NAME)?.value ?? null,
    });
    const cards = getCollectionCards({
      slug: staticCollection.slug,
      marketCountry: market.country,
      limit: 8,
    });
    const viewResultsHref =
      buildCollectionResultsHref({
        slug: staticCollection.slug,
        marketCountry: market.country,
      }) ?? "/properties";

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-12 pt-5">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-900 via-sky-800 to-slate-700 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/80">Collections</p>
            <h1 className="mt-1 text-2xl font-semibold">{staticCollection.title}</h1>
            <p className="mt-2 text-sm text-white/90">{staticCollection.description}</p>
            <p className="mt-2 text-xs text-white/80">Market-aware picks for {market.country}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-6 py-3">
            <Link href={viewResultsHref}>
              <Button data-testid="collections-view-results-cta">View results</Button>
            </Link>
            <Link href="/collections">
              <Button variant="secondary">All collections</Button>
            </Link>
          </div>
        </header>

        <section className="space-y-3" data-testid="collections-hero">
          <h2 className="text-lg font-semibold text-slate-900">Featured in this collection</h2>
          <div
            className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
            data-testid="collections-rail"
          >
            {cards.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                data-testid="collections-card"
                className="inline-flex w-[250px] shrink-0 snap-start flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {card.tag}
                </span>
                <p className="text-base font-semibold text-slate-900">{card.title}</p>
                <p className="text-sm text-slate-600">{card.subtitle}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!isUuid(shareId)) notFound();

  if (!hasServiceRoleEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Shared collection</h1>
        <p className="text-sm text-slate-600">
          Shared collections are temporarily unavailable.
        </p>
        <Link href="/properties" className="inline-flex">
          <Button variant="secondary">Browse listings</Button>
        </Link>
      </div>
    );
  }

  const service = createServiceRoleClient();
  const collection = await getPublicCollectionByShareId({
    supabase: service,
    shareId,
  });
  if (!collection) {
    notFound();
  }
  const visibleProperties = collection.properties.filter((property) =>
    isPubliclyVisibleCollectionListing({
      listing: property,
      includeDemo: false,
    })
  );

  const listingIds = visibleProperties.map((property) => property.id).filter(Boolean);
  const ownerIds = Array.from(
    new Set(visibleProperties.map((property) => property.owner_id).filter(Boolean))
  );
  const [trustSnapshotsByOwner, socialProofByListing] = await Promise.all([
    ownerIds.length
      ? fetchTrustPublicSnapshots(
          service as unknown as Parameters<typeof fetchTrustPublicSnapshots>[0],
          ownerIds
        )
      : Promise.resolve({} as Record<string, TrustMarkerState>),
    listingIds.length
      ? getListingPopularitySignals({ client: service, listingIds })
      : Promise.resolve({} as Record<string, ListingSocialProof>),
  ]);
  const siteUrl = await getSiteUrl();
  const shareUrl =
    buildCollectionShareUrl(shareId, siteUrl) ||
    `${siteUrl.replace(/\/$/, "")}/collections/${encodeURIComponent(shareId)}`;
  const coverImageUrl =
    visibleProperties[0]?.cover_image_url || visibleProperties[0]?.images?.[0]?.image_url || null;
  const city = deriveCollectionCity(
    visibleProperties
      .map((property) => property.city?.trim())
      .filter((value): value is string => !!value)
  );
  const derivedFilters = deriveSavedSearchFiltersFromCollectionListings(visibleProperties);
  const parsedFilters = parseFiltersFromSavedSearch(derivedFilters);
  const startSearchParams = filtersToSearchParams(parsedFilters);
  if (!startSearchParams.get("intent")) {
    startSearchParams.set("intent", parsedFilters.listingIntent ?? "all");
  }
  const startSearchHref = startSearchParams.toString()
    ? `/properties?${startSearchParams.toString()}`
    : "/properties";
  const collectionTitle = collection.title?.trim() || "Shared shortlist";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-24 pt-5 sm:pb-5">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative">
          {coverImageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(110deg, rgba(2,6,23,0.72), rgba(15,23,42,0.45) 55%, rgba(15,23,42,0.2)), url(${coverImageUrl})`,
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-sky-800 to-slate-700" />
          )}
          <div className="relative space-y-3 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/80">Shared collection</p>
            <h1 className="text-2xl font-semibold">{collectionTitle}</h1>
            <p className="text-sm text-white/90">A curated shortlist on PropatyHub</p>
            <p className="text-xs text-white/80">
              {visibleProperties.length} {visibleProperties.length === 1 ? "home" : "homes"}
              {city ? ` • ${city}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-6 py-3 text-sm text-slate-600">
          <span>Read-only view.</span>
          <span className="hidden sm:inline">Sign in to save homes into your own collections.</span>
          <Link href="/properties">
            <Button variant="secondary" size="sm">
              Browse
            </Button>
          </Link>
          <Link href="/auth/login?reason=auth">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <PublicSharedCollectionActions
        shareId={shareId}
        collectionTitle={collectionTitle}
        shareUrl={shareUrl}
        showStickyMobile
      />

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <Link href={startSearchHref} className="font-semibold text-sky-700 hover:text-sky-800">
          Start your search
        </Link>
      </div>

      {visibleProperties.length ? (
        <section className="grid gap-4 md:grid-cols-2">
          {visibleProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              href={`/properties/${property.id}`}
              trustMarkers={trustSnapshotsByOwner[property.owner_id]}
              socialProof={socialProofByListing[property.id] ?? null}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            This shortlist is empty or no longer available.
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Listings may have expired or been removed from public view.
          </p>
          <Link href="/properties" className="mt-4 inline-flex">
            <Button variant="secondary" size="sm">
              Browse homes
            </Button>
          </Link>
        </section>
      )}
    </div>
  );
}
