import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapToggle } from "@/components/properties/PropertyMapToggle";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { SavedSearchButton } from "@/components/search/SavedSearchButton";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { DEV_MOCKS, getApiBaseUrl, getEnvPresence } from "@/lib/env";
import { mockProperties } from "@/lib/mock";
import { getTenantPlanForTier } from "@/lib/plans";
import { getBrowseEmptyStateCtas } from "@/lib/property-discovery";
import { normalizeRole } from "@/lib/roles";
import { filtersToChips, parseFiltersFromParams, parseFiltersFromSavedSearch } from "@/lib/search-filters";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { searchProperties } from "@/lib/search";
import type { ParsedSearchFilters, Property, SavedSearch, UserRole } from "@/lib/types";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
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

function applyMockFilters(items: Property[], filters: ParsedSearchFilters): Property[] {
  return items.filter((property) => {
    if (filters.city) {
      const cityMatch = property.city.toLowerCase().includes(filters.city.toLowerCase());
      if (!cityMatch) return false;
    }
    if (filters.minPrice !== null && property.price < filters.minPrice) return false;
    if (filters.maxPrice !== null && property.price > filters.maxPrice) return false;
    if (filters.currency && property.currency.toLowerCase() !== filters.currency.toLowerCase()) {
      return false;
    }
    if (filters.bedrooms !== null && property.bedrooms < filters.bedrooms) return false;
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

export default async function PropertiesPage({ searchParams }: Props) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const savedSearchId = readParam(resolvedSearchParams, "savedSearchId");
  const page = parsePage(resolvedSearchParams);
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
    Object.values(filters).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== "";
    });
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
  let totalCount: number | null = null;
  let fetchError: string | null = null;
  let trustSnapshots: Record<string, TrustMarkerState> = {};
  const hubs = [
    { city: "Lagos", label: "Lagos Island" },
    { city: "Nairobi", label: "Nairobi" },
    { city: "Accra", label: "Accra" },
    { city: "Dakar", label: "Dakar" },
  ];

  try {
    if (hasFilters && supabaseReady) {
      const { data, error, count } = await searchProperties(filters, {
        page,
        pageSize: PAGE_SIZE,
        approvedBefore,
      });
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
        totalCount = typeof count === "number" ? count : null;
        properties = properties.filter((p) => !!p.id);
        if (typed.length !== properties.length) {
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
      const cookieHeader = cookies().toString();
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
        properties =
          typed.map((row) => ({
            ...row,
            images: row.property_images?.map((img) => ({
              id: img.id,
              image_url: img.image_url,
            })),
          })) || [];
        totalCount = typeof json.total === "number" ? json.total : null;
        properties = properties.filter((p) => !!p.id);
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
    const fallback = hasFilters ? applyMockFilters(mockProperties, filters) : mockProperties;
    if (fallback.length) {
      properties = fallback;
      fetchError = null;
    }
  }

  if (supabaseReady && properties.length) {
    try {
      const supabase = await createServerSupabaseClient();
      const ownerIds = properties.map((property) => property.owner_id);
      trustSnapshots = await fetchTrustPublicSnapshots(supabase, ownerIds);
    } catch (err) {
      console.warn("[properties] trust snapshot fetch failed", err);
      trustSnapshots = {};
    }
  }

  if (!properties.length) {
    if (savedSearchId && savedSearch) {
      const editHref = `/dashboard/saved-searches`;
      return (
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4">
          {savedSearchNoticeNode}
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
    const emptyDescription = hasFilters
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
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4">
        {savedSearchNoticeNode}
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      {savedSearchNoticeNode}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-600">
            Showing {properties.length} of {total} homes
            {filters.city ? ` in ${filters.city}` : ""}.
          </p>
        </div>
        {showListCta && (
          <Link href="/dashboard/properties/new">
            <Button variant="secondary">List a property</Button>
          </Link>
        )}
      </div>

      {savedSearch && (
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Saved search</p>
          <p className="text-sm font-semibold text-slate-900">
            Matches for "{savedSearch.name || "your saved search"}"
          </p>
          <p className="text-sm text-slate-600">
            Filters applied from your saved search.
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

      {role === "tenant" && !isTenantPro && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Upgrade for instant alerts</p>
          <p className="mt-1 text-sm text-slate-600">
            Tenant Pro unlocks unlimited saved searches and faster access to new homes.
          </p>
          <Link href="/tenant/billing#plans" className="mt-2 inline-flex text-sm font-semibold text-sky-700">
            View Tenant Pro
          </Link>
        </div>
      )}

      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
          <p className="font-semibold uppercase tracking-[0.2em] text-slate-500">
            Active filters
          </p>
          {filterChips.map((chip) => (
            <span
              key={`${chip.label}-${chip.value}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700"
            >
              {chip.label}: {chip.value}
            </span>
          ))}
          <Link
            href="/properties"
            className="rounded-full border border-slate-100 px-3 py-1 font-semibold text-slate-600 transition hover:border-sky-100"
          >
            Clear
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Saved searches</p>
          <p className="text-sm text-slate-600">Save this filter set for alerts later.</p>
        </div>
        <SavedSearchButton filters={filters} />
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
            href={`/properties/${property.id}?back=${encodeURIComponent(backHref)}`}
            trustMarkers={trustSnapshots[property.owner_id]}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          {prevPage ? (
            <Link
              href={prevPage}
              className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              Previous
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-full border border-slate-100 px-3 py-1 font-semibold text-slate-400">
              Previous
            </span>
          )}
          {nextPage ? (
            <Link
              href={nextPage}
              className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              Next
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-full border border-slate-100 px-3 py-1 font-semibold text-slate-400">
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
