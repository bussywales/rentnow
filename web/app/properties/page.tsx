import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapToggle } from "@/components/properties/PropertyMapToggle";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { AdvancedSearchPanel } from "@/components/properties/AdvancedSearchPanel";
import { BrowseIntentClient } from "@/components/properties/BrowseIntentClient";
import { ListingIntentToggle } from "@/components/properties/ListingIntentToggle";
import { SavedSearchButton } from "@/components/search/SavedSearchButton";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { DEV_MOCKS, getApiBaseUrl, getEnvPresence } from "@/lib/env";
import { mockProperties } from "@/lib/mock";
import { getTenantPlanForTier } from "@/lib/plans";
import { getBrowseEmptyStateCtas } from "@/lib/property-discovery";
import { normalizeRole } from "@/lib/roles";
import {
  filtersToChips,
  hasActiveFilters,
  parseFiltersFromParams,
  parseFiltersFromSavedSearch,
} from "@/lib/search-filters";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { searchProperties } from "@/lib/search";
import type { ParsedSearchFilters, Property, SavedSearch, UserRole } from "@/lib/types";
import { orderImagesWithCover } from "@/lib/properties/images";
import { computeLocationScore, extractLocationQuery, type LocationQueryInfo } from "@/lib/properties/location-score";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import { isListingPubliclyVisible } from "@/lib/properties/expiry";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import { fetchSavedPropertyIds } from "@/lib/saved-properties.server";
import { getFastResponderByHostIds } from "@/lib/trust/fast-responder.server";
import { getListingPopularitySignals } from "@/lib/properties/popularity.server";
import type { ListingSocialProof } from "@/lib/properties/listing-trust-badges";
import { getMarketSettings } from "@/lib/market/market.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { buildMarketHubHref, getMarketHubs } from "@/lib/market/hubs";
import { INTENT_COOKIE_NAME, parseIntent, resolveIntent } from "@/lib/search-intent";
import { MarketHubLink } from "@/components/market/MarketHubLink";
import { HelpDrawerTrigger } from "@/components/help/HelpDrawerTrigger";
import {
  buildClearFiltersHref,
  buildIntentHref,
  getIntentRecoveryOptions,
  getIntentSummaryCopy,
} from "@/lib/properties/listing-intent-ui";
type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

export const dynamic = "force-dynamic";
const PAGE_SIZE = 9;

async function resolveSearchParams(
  params: Props["searchParams"]
): Promise<SearchParams> {
  if (!params) return {};
  const maybePromise = params as Promise<SearchParams>;
  const isPromise = typeof (maybePromise as { then?: unknown }).then === "function";
  if (isPromise) {
    return maybePromise;
  }
  return params as SearchParams;
}

function parsePage(params: SearchParams): number {
  const raw = params.page;
  if (Array.isArray(raw)) {
    const first = raw[0];
    const num = Number(first);
    return Number.isFinite(num) && num > 0 ? num : 1;
  }
  if (raw) {
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : 1;
  }
  return 1;
}

function parseBooleanParam(params: SearchParams, key: string): boolean {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return false;
  return value === "true" || value === "1" || value.toLowerCase() === "yes";
}

function parseRecentDays(params: SearchParams): number | null {
  const raw = params.recent;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(num, 90);
}

function readParam(params: SearchParams, key: string): string | null {
  const raw = params[key];
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  if (typeof raw === "string") {
    return raw;
  }
  return null;
}

function buildSearchParams(
  params: SearchParams,
  overrides: Record<string, string | null>
) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    if (Array.isArray(value)) {
      value
        .filter((entry) => entry !== undefined && entry !== "")
        .forEach((entry) => next.append(key, entry));
      return;
    }
    next.append(key, value);
  });

  Object.entries(overrides).forEach(([key, value]) => {
    next.delete(key);
    if (value !== null) next.set(key, value);
  });

  return next;
}

function applyMockFilters(
  items: Property[],
  filters: ParsedSearchFilters,
  options: { featuredOnly?: boolean; createdAfter?: string | null; includeDemo?: boolean } = {}
): Property[] {
  return items.filter((property) => {
    if (!isListingPubliclyVisible(property)) return false;
    if (!options.includeDemo && property.is_demo) return false;
    if (options.featuredOnly && !property.is_featured) return false;
    if (options.createdAfter && property.created_at) {
      const created = Date.parse(property.created_at);
      if (!Number.isNaN(created) && created < Date.parse(options.createdAfter)) {
        return false;
      }
    }
    if (filters.city) {
      const cityMatch = property.city.toLowerCase().includes(filters.city.toLowerCase());
      if (!cityMatch) return false;
    }
    if (filters.minPrice !== null && property.price < filters.minPrice) return false;
    if (filters.maxPrice !== null && property.price > filters.maxPrice) return false;
    if (filters.currency && property.currency.toLowerCase() !== filters.currency.toLowerCase()) {
      return false;
    }
    if (filters.bedrooms !== null) {
      const bedroomsMode = filters.bedroomsMode ?? "exact";
      if (bedroomsMode === "minimum" && property.bedrooms < filters.bedrooms) return false;
      if (bedroomsMode === "exact" && property.bedrooms !== filters.bedrooms) return false;
    }
    if (filters.propertyType && property.listing_type !== filters.propertyType) return false;
    if (filters.listingIntent && filters.listingIntent !== "all") {
      const intent = property.listing_intent ?? "rent";
      if (intent !== filters.listingIntent) return false;
    }
    if (filters.rentalType && property.rental_type !== filters.rentalType) return false;
    if (filters.furnished !== null && property.furnished !== filters.furnished) return false;
    if (filters.amenities.length) {
      const available = new Set((property.amenities || []).map((item) => item.toLowerCase()));
      const needsAll = filters.amenities.every((item) => available.has(item.toLowerCase()));
      if (!needsAll) return false;
    }
    return true;
  });
}

function mapSearchRowsToProperties(
  rows: Array<Property & { property_images?: Array<{ id: string; image_url: string }> }>
): Property[] {
  return rows
    .map((row) => {
      const mappedImages =
        row.property_images?.map((img) => ({
          id: img.id || img.image_url,
          image_url: img.image_url,
          position: (img as { position?: number }).position,
          created_at: (img as { created_at?: string | null }).created_at ?? undefined,
          width: (img as { width?: number | null }).width ?? null,
          height: (img as { height?: number | null }).height ?? null,
          bytes: (img as { bytes?: number | null }).bytes ?? null,
          format: (img as { format?: string | null }).format ?? null,
        })) || [];
      return {
        ...row,
        images: orderImagesWithCover(row.cover_image_url, mappedImages),
      };
    })
    .filter((p) => !!p.id);
}

export default async function PropertiesPage({ searchParams }: Props) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const cookieStore = await cookies();
  const urlIntent = parseIntent(readParam(resolvedSearchParams, "intent"));
  const cookieIntent = parseIntent(cookieStore.get(INTENT_COOKIE_NAME)?.value ?? null);
  const savedSearchId = readParam(resolvedSearchParams, "savedSearchId");
  const page = parsePage(resolvedSearchParams);
  const featuredOnly = parseBooleanParam(resolvedSearchParams, "featured");
  const recentDays = parseRecentDays(resolvedSearchParams);
  const createdAfter =
    recentDays && recentDays > 0
      ? new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const supabaseReady = hasServerSupabaseEnv();
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> | null = null;
  let userId: string | null = null;
  let role: UserRole | null = null;
  let isTenantPro = false;
  let approvedBefore: string | null = null;
  const earlyAccessMinutes = getTenantPlanForTier("tenant_pro").earlyAccessMinutes;
  if (supabaseReady) {
    try {
      supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        role = normalizeRole(profile?.role);
        if (role === "tenant") {
          const { data: planRow } = await supabase
            .from("profile_plans")
            .select("plan_tier, valid_until")
            .eq("profile_id", user.id)
            .maybeSingle();
          const validUntil = planRow?.valid_until ?? null;
          const expired =
            !!validUntil &&
            Number.isFinite(Date.parse(validUntil)) &&
            Date.parse(validUntil) < Date.now();
          const tenantPlan = getTenantPlanForTier(expired ? "free" : planRow?.plan_tier ?? "free");
          isTenantPro = tenantPlan.tier === "tenant_pro";
        }
      }
      if ((!role || role === "tenant") && !isTenantPro && earlyAccessMinutes > 0) {
        approvedBefore = new Date(
          Date.now() - earlyAccessMinutes * 60 * 1000
        ).toISOString();
      }
    } catch {
      role = null;
    }
  }

  let filters = parseFiltersFromParams(resolvedSearchParams);
  let savedSearch: SavedSearch | null = null;
  let savedSearchError: string | null = null;

  if (savedSearchId) {
    if (!supabaseReady) {
      savedSearchError = "Supabase is not configured.";
    } else if (!supabase || !userId) {
      const redirectParams = new URLSearchParams();
      redirectParams.set("savedSearchId", savedSearchId);
      redirectParams.set("source", "saved-search");
      redirect(
        `/auth/login?reason=auth&redirect=${encodeURIComponent(
          `/properties?${redirectParams.toString()}`
        )}`
      );
    } else {
      const { data: savedSearchRow, error: savedSearchFetchError } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("id", savedSearchId)
        .eq("user_id", userId)
        .maybeSingle();
      if (savedSearchFetchError || !savedSearchRow) {
        savedSearchError = "Saved search not found";
      } else {
        savedSearch = savedSearchRow as SavedSearch;
        filters = parseFiltersFromSavedSearch(savedSearch.query_params || {});
      }
    }
  }

  const shouldFavorSavedSearchIntent = !!savedSearchId && !urlIntent;
  const resolvedIntent =
    resolveIntent({
      urlIntent,
      cookieIntent: shouldFavorSavedSearchIntent ? null : cookieIntent,
      defaultIntent: filters.listingIntent ?? (shouldFavorSavedSearchIntent ? "all" : "rent"),
    }) ?? (shouldFavorSavedSearchIntent ? "all" : "rent");
  filters = {
    ...filters,
    listingIntent: resolvedIntent,
  };

  const savedSearchNotice =
    savedSearchId && savedSearchError
      ? savedSearchError === "Supabase is not configured."
        ? {
            title: "Saved searches unavailable",
            description: "Saved searches are unavailable right now. You can still browse all homes.",
          }
        : {
            title: "Saved search unavailable",
            description:
              "We couldn't load that saved search. It may have been deleted, expired, or belongs to another account.",
          }
      : null;

  const filterChips = filtersToChips(filters);
  const hasFilters =
    !!savedSearch ||
    featuredOnly ||
    !!createdAfter ||
    hasActiveFilters(filters);
  const savedSearchNoticeNode = savedSearchNotice ? (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 shadow-sm">
      <p className="font-semibold">{savedSearchNotice.title}</p>
      <p className="mt-1 text-amber-800">{savedSearchNotice.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link href="/dashboard/saved-searches">
          <Button size="sm" variant="secondary">
            Back to saved searches
          </Button>
        </Link>
        <Link href="/properties">
          <Button size="sm">View all homes</Button>
        </Link>
      </div>
    </div>
  ) : null;
  const showListCta = role && role !== "tenant";
  const savedSearchesHref =
    role === "tenant"
      ? "/tenant/saved-searches"
      : role === "agent" || role === "landlord"
      ? "/dashboard/saved-searches"
      : "/saved-searches";
  const [requestHeaders, marketSettings] = await Promise.all([
    headers(),
    getMarketSettings(),
  ]);
  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: cookieStore.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });
  const marketHubs = getMarketHubs(market.country);
  const marketHubLinks = marketHubs.map((hub) => ({
    key: hub.key,
    label: hub.label,
    href: buildMarketHubHref(hub, { intent: resolvedIntent }),
  }));
  const showMarketHubSuggestions = !hasFilters && marketHubLinks.length > 0;
  const intentRecoveryBaseParams = buildSearchParams(resolvedSearchParams, {
    success: null,
  });
  const intentClearFiltersHref = buildClearFiltersHref(
    "/properties",
    intentRecoveryBaseParams,
    resolvedIntent
  );
  const intentRecoveryOptions = getIntentRecoveryOptions(resolvedIntent);
  const intentRecoveryCard = intentRecoveryOptions.length ? (
    <div
      className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 shadow-sm"
      data-testid="intent-recovery-card"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700">No results in this mode</p>
      <p className="mt-1 text-sm text-sky-800">
        Widen your browse mode while keeping the rest of your filters.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {intentRecoveryOptions.map((option) => (
          <Link
            key={option.intent}
            href={buildIntentHref("/properties", intentRecoveryBaseParams, option.intent)}
          >
            <Button size="sm" variant="secondary">
              {option.label}
            </Button>
          </Link>
        ))}
        <Link href={intentClearFiltersHref}>
          <Button size="sm" variant="secondary">
            Clear filters
          </Button>
        </Link>
      </div>
    </div>
  ) : null;
  const includeDemoListings = includeDemoListingsForViewer({ viewerRole: role });
  const apiBaseUrl = await getApiBaseUrl();
  const listParams = buildSearchParams(resolvedSearchParams, {
    page: String(page),
    pageSize: String(PAGE_SIZE),
    savedSearchId: null,
    source: null,
  });
  const apiUrl = `${apiBaseUrl}/api/properties?${listParams.toString()}`;
  const envPresence = getEnvPresence();
  let properties: Property[] = [];
  let otherOptionProperties: Property[] = [];
  let totalCount: number | null = null;
  let fetchError: string | null = null;
  let trustSnapshots: Record<string, TrustMarkerState> = {};
  let savedIds = new Set<string>();
  let fastResponderByHost: Record<string, boolean> = {};
  let socialProofByListing: Record<string, ListingSocialProof> = {};

  try {
    if (hasFilters && supabaseReady) {
      const { data, error, count } = await searchProperties(filters, {
        page,
        pageSize: PAGE_SIZE,
        approvedBefore,
        featuredOnly,
        createdAfter,
        includeDemo: includeDemoListings,
      });
      if (error) {
        fetchError = error.message;
      }
      if (!error && data) {
        const typed = (data ?? []) as Array<
          Property & { property_images?: Array<{ id: string; image_url: string }> }
        >;
        const queryInfo: LocationQueryInfo = filters.city
          ? extractLocationQuery(filters.city)
          : { tokens: [] };
        const shouldScore = queryInfo.tokens.length > 0 || !!queryInfo.postalPrefix;
        const orderedRows = typed
          .map((row, index) => ({
            row,
            index,
            score: shouldScore ? computeLocationScore(row, queryInfo) : 0,
          }))
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.index - b.index;
          })
          .map((item) => item.row);
        properties = mapSearchRowsToProperties(orderedRows);
        totalCount = typeof count === "number" ? count : null;
        if (orderedRows.length !== properties.length) {
          console.warn("[properties] dropped filtered items without id", {
            total: typed.length,
            kept: properties.length,
            filters,
          });
        }
        console.log("[properties] filtered via Supabase", {
          count: properties.length,
          filters,
        });
      }
    } else if (hasFilters) {
      fetchError = fetchError ?? "Supabase env vars missing; live filtering is unavailable.";
    } else {
      const cookieHeader = cookieStore.toString();
      const apiRes = await fetch(apiUrl, {
        ...(cookieHeader ? { cache: "no-store" } : { next: { revalidate: 60 } }),
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      });
      if (!apiRes.ok) {
        fetchError = `API responded with ${apiRes.status}`;
      } else {
        const json = await apiRes.json();
        const typed =
          (json.properties as Array<
            Property & { property_images?: Array<{ id: string; image_url: string }> }
          >) || [];
        properties = mapSearchRowsToProperties(typed);
        totalCount = typeof json.total === "number" ? json.total : null;
        if (typed.length !== properties.length) {
          console.warn("[properties] dropped items without id from API", {
            total: typed.length,
            kept: properties.length,
            apiUrl,
          });
        }
        console.log("[properties] fetched via API", {
          count: properties.length,
          apiUrl,
          sample: properties[0]?.title,
        });
      }
    }
  } catch (err) {
    console.error("[properties] fetch failed", err);
    fetchError = err instanceof Error ? err.message : "Unknown error while fetching properties";
  }

  if (DEV_MOCKS && !properties.length) {
    const fallback = hasFilters
      ? applyMockFilters(mockProperties, filters, {
          featuredOnly,
          createdAfter,
          includeDemo: includeDemoListings,
        })
      : mockProperties.filter((property) => includeDemoListings || !property.is_demo);
    if (fallback.length) {
      properties = fallback;
      fetchError = null;
    }
  }

  const requestedBedrooms = filters.bedrooms;
  const bedroomsMode = filters.bedroomsMode ?? "exact";
  const includeSimilarOptions = Boolean(filters.includeSimilarOptions);

  if (requestedBedrooms !== null && !includeSimilarOptions && bedroomsMode === "exact") {
    const strictExact = properties.filter((item) => item.bedrooms === requestedBedrooms);
    properties = strictExact;

    if (hasFilters && supabaseReady) {
      const { data, error } = await searchProperties(
        {
          ...filters,
          bedroomsMode: "minimum",
          includeSimilarOptions: false,
        },
        {
          page: 1,
          pageSize: PAGE_SIZE,
          approvedBefore,
          featuredOnly,
          createdAfter,
          includeDemo: includeDemoListings,
        }
      );
      if (!error && data) {
        const similarRows = (data as Array<
          Property & { property_images?: Array<{ id: string; image_url: string }> }
        >) ?? [];
        otherOptionProperties = mapSearchRowsToProperties(similarRows).filter(
          (item) => item.bedrooms > requestedBedrooms
        );
      }
    } else if (DEV_MOCKS) {
      otherOptionProperties = applyMockFilters(
        mockProperties,
        {
          ...filters,
          bedroomsMode: "minimum",
        },
        { includeDemo: includeDemoListings }
      ).filter((item) => item.bedrooms > requestedBedrooms);
    }
  } else if (requestedBedrooms !== null) {
    const exactMatches = properties.filter((item) => item.bedrooms === requestedBedrooms);
    const similarMatches = properties.filter((item) => item.bedrooms > requestedBedrooms);
    properties = [...exactMatches, ...similarMatches];
    otherOptionProperties = similarMatches;
  }

  const displayProperties = Array.from(
    new Map([...properties, ...otherOptionProperties].map((item) => [item.id, item])).values()
  );

  if (supabaseReady && displayProperties.length) {
    try {
      const supabase = await createServerSupabaseClient();
      const ownerIds = displayProperties.map((property) => property.owner_id);
      trustSnapshots = await fetchTrustPublicSnapshots(supabase, ownerIds);
      if (userId) {
        savedIds = await fetchSavedPropertyIds({
          supabase,
          userId,
          propertyIds: displayProperties.map((property) => property.id),
        });
      }
      const uniqueOwners = Array.from(new Set(ownerIds.filter(Boolean)));
      if (uniqueOwners.length) {
        fastResponderByHost = await getFastResponderByHostIds({
          supabase,
          hostIds: uniqueOwners,
        });
      }
      socialProofByListing = await getListingPopularitySignals({
        client: supabase,
        listingIds: displayProperties.map((property) => property.id),
      });
    } catch (err) {
      console.warn("[properties] trust snapshot fetch failed", err);
      trustSnapshots = {};
      savedIds = new Set<string>();
      fastResponderByHost = {};
      socialProofByListing = {};
    }
  }

  if (!properties.length && !otherOptionProperties.length) {
    if (savedSearchId && savedSearch) {
      const editHref = `/dashboard/saved-searches`;
      return (
        <div
          className="mx-auto flex max-w-4xl flex-col gap-4 px-4"
          data-testid="properties-empty-state"
        >
          {savedSearchNoticeNode}
          {intentRecoveryCard}
          <ErrorState
            title="No matches yet for this search"
            description="No homes match yet — try widening your filters."
            retryAction={
              <Link href={editHref}>
                <Button size="sm">Edit saved search</Button>
              </Link>
            }
          />
        </div>
      );
    }
    const featuredEmptyDescription =
      "No featured homes are available right now. Browse all listings or check back soon.";
    const emptyDescription = featuredOnly
      ? featuredEmptyDescription
      : hasFilters
        ? "No homes match your filters yet. Try clearing filters or browsing all homes."
        : "No homes are available right now. Check back soon or browse all homes.";
    const isFetchError = !!fetchError;
    const title = isFetchError ? "Unable to load homes" : "No properties found";
    const description = isFetchError
      ? "We couldn't load homes right now. Please try again."
      : emptyDescription;
    const retryParams = buildSearchParams(resolvedSearchParams, {});
    const retryHref = retryParams.toString()
      ? `/properties?${retryParams.toString()}`
      : "/properties";
    const emptyCtas = getBrowseEmptyStateCtas({ role, hasFilters });
    const showDiagnostics =
      isFetchError && process.env.NODE_ENV === "development";
    const showRetry = isFetchError;
    const renderEmptyCta = (cta: (typeof emptyCtas)[number]) => {
      if (cta.kind === "primary") {
        return (
          <Link key={cta.label} href={cta.href}>
            <Button size="sm">{cta.label}</Button>
          </Link>
        );
      }
      if (cta.kind === "secondary") {
        return (
          <Link key={cta.label} href={cta.href}>
            <Button size="sm" variant="secondary">
              {cta.label}
            </Button>
          </Link>
        );
      }
      return (
        <Link
          key={cta.label}
          href={cta.href}
          className="text-sky-700 font-semibold"
        >
          {cta.label}
        </Link>
      );
    };

    return (
      <div
        className="mx-auto flex max-w-4xl flex-col gap-4 px-4"
        data-testid="properties-empty-state"
      >
        {savedSearchNoticeNode}
        {!isFetchError ? intentRecoveryCard : null}
        <ErrorState
          title={title}
          description={description}
          retryAction={
            <>
              {showRetry && (
                <Link href={retryHref}>
                  <Button size="sm" variant="secondary">
                    Retry
                  </Button>
                </Link>
              )}
              {emptyCtas.map((cta) => renderEmptyCta(cta))}
              {showListCta && (
                <Link href="/dashboard/properties/new" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
                  List your first property
                </Link>
              )}
            </>
          }
          diagnostics={
            showDiagnostics
              ? {
                  apiUrl,
                  hasFilters,
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

  const total = typeof totalCount === "number" ? totalCount : properties.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const backParams = buildSearchParams(resolvedSearchParams, {});
  const backHref = backParams.toString()
    ? `/properties?${backParams.toString()}`
    : "/properties";
  const prevPage =
    page > 1
      ? `/properties?${buildSearchParams(resolvedSearchParams, { page: String(page - 1) }).toString()}`
      : null;
  const nextPage =
    page < totalPages
      ? `/properties?${buildSearchParams(resolvedSearchParams, { page: String(page + 1) }).toString()}`
      : null;
  const exactOnlyMode =
    requestedBedrooms !== null && !includeSimilarOptions && bedroomsMode === "exact";
  const hasOtherOptionsSection = exactOnlyMode && otherOptionProperties.length > 0;
  const showingLabel = exactOnlyMode ? "exact matches" : "homes";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4">
      {savedSearchNoticeNode}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-500">
            Showing {properties.length} of {total} {showingLabel}
            {filters.city ? ` in ${filters.city}` : ""}.
          </p>
          {exactOnlyMode && requestedBedrooms !== null && (
            <p className="text-xs text-slate-500">
              Exact beds: {requestedBedrooms}. Expand More options to include similar bed counts.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {role ? <HelpDrawerTrigger label="Need help?" testId="properties-help-trigger" /> : null}
          {showListCta && (
            <Link href="/dashboard/properties/new">
              <Button variant="secondary">List a property</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="-mx-4 sticky top-16 z-20 border-y border-slate-200/70 bg-slate-50/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <ListingIntentToggle currentIntent={resolvedIntent} hasUrlIntent={urlIntent !== undefined} />
      </div>

      {savedSearch && (
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Saved search</p>
          <p className="text-sm font-semibold text-slate-900">
            Matches for &quot;{savedSearch.name || "your saved search"}&quot;
          </p>
          <p className="text-sm text-slate-500">
            Filters applied from your saved search. {getIntentSummaryCopy(resolvedIntent)}.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href="/dashboard/saved-searches">
              <Button size="sm" variant="secondary">
                Edit saved search
              </Button>
            </Link>
            <Link href="/properties">
              <Button size="sm">Clear filters</Button>
            </Link>
          </div>
        </div>
      )}

      <SmartSearchBox mode="browse" />
      <AdvancedSearchPanel initialFilters={filters} />
      <BrowseIntentClient
        persistFilters={hasFilters}
        showContinueBanner={showMarketHubSuggestions}
      />

      {role === "tenant" && !isTenantPro && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Upgrade for instant alerts</p>
          <p className="mt-1 text-sm text-slate-500">
            Tenant Pro unlocks unlimited saved searches and faster access to new homes.
          </p>
          <Link href="/tenant/billing#plans" className="mt-2 inline-flex text-sm font-semibold text-sky-700">
            View Tenant Pro
          </Link>
        </div>
      )}

      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2.5 text-xs text-slate-700 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Active filters
          </p>
          {filterChips.map((chip) => (
            <span
              key={`${chip.label}-${chip.value}`}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
            >
              {chip.label}: {chip.value}
            </span>
          ))}
          <Link
            href="/properties"
            className="rounded-full border border-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:border-sky-100"
          >
            Clear
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Saved searches</p>
          <p className="text-sm text-slate-500">Save this filter set for alerts later.</p>
        </div>
        <SavedSearchButton filters={filters} savedSearchesHref={savedSearchesHref} />
      </div>

      {showMarketHubSuggestions ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Popular starting points
          </p>
          {marketHubLinks.map((hub) => (
            <MarketHubLink
              key={hub.key}
              href={hub.href}
              country={market.country}
              label={hub.label}
              className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              {hub.label}
            </MarketHubLink>
          ))}
        </div>
      ) : null}

      {exactOnlyMode && (
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Exact matches
          </p>
          <p className="text-sm text-slate-600">
            Showing properties with exactly {requestedBedrooms} bedrooms.
          </p>
        </div>
      )}

      {properties.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-3" data-testid="properties-grid">
          {properties.map((property) => (
            <div key={property.id} className="h-full" data-testid="property-card">
              <PropertyCard
                property={property}
                href={`/properties/${property.id}?back=${encodeURIComponent(backHref)}`}
                trustMarkers={trustSnapshots[property.owner_id]}
                showSave
                initialSaved={savedIds.has(property.id)}
                showCta={!role || role === "tenant"}
                viewerRole={role}
                fastResponder={fastResponderByHost[property.owner_id]}
                socialProof={socialProofByListing[property.id] ?? null}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          No exact matches on this page. Check other available options below.
        </div>
      )}

      {hasOtherOptionsSection && (
        <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
            Other available options
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            Nearby alternatives with higher bedroom counts. Turn on “Include similar options” in More options to merge these into the main grid.
          </p>
          <div className="mt-4 grid gap-5 md:grid-cols-3" data-testid="properties-other-options-grid">
            {otherOptionProperties.map((property) => (
              <div key={property.id} className="h-full" data-testid="property-card-other-option">
                <PropertyCard
                  property={property}
                  href={`/properties/${property.id}?back=${encodeURIComponent(backHref)}`}
                  trustMarkers={trustSnapshots[property.owner_id]}
                  showSave
                  initialSaved={savedIds.has(property.id)}
                  showCta={!role || role === "tenant"}
                  viewerRole={role}
                  fastResponder={fastResponderByHost[property.owner_id]}
                  socialProof={socialProofByListing[property.id] ?? null}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          {prevPage ? (
            <Link
              href={prevPage}
              className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              Previous
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-full border border-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
              Previous
            </span>
          )}
          {nextPage ? (
            <Link
              href={nextPage}
              className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              Next
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-full border border-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
              Next
            </span>
          )}
        </div>
      </div>

      <PropertyMapToggle
        properties={properties.slice(0, 12)}
        height="420px"
        title="Listings map"
        description="Open the map only when you need it to keep the grid fast."
      />
    </div>
  );
}
