import Link from "next/link";
import { redirect } from "next/navigation";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { getCountryByCode } from "@/lib/countries";
import { DEV_MOCKS } from "@/lib/env";
import { mockProperties } from "@/lib/mock";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  getCityCollections,
  getFallbackHomes,
  getFeaturedHomes,
  getNewHomes,
  getPopularHomes,
  getTenantDiscoveryContext,
} from "@/lib/tenant/tenant-discovery.server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODULE_LIMIT = 10;

const DEFAULT_CITY_BY_JURISDICTION: Record<string, string> = {
  NG: "Lagos",
  GH: "Accra",
  KE: "Nairobi",
  ZA: "Johannesburg",
  UG: "Kampala",
  EG: "Cairo",
  RW: "Kigali",
  US: "New York",
  GB: "London",
};

type SectionHeaderProps = {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
};

function SectionHeader({ title, description, href, hrefLabel = "View all" }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-600">{description}</p>}
      </div>
      {href && (
        <Link href={href} className="text-sm font-semibold text-sky-700">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

function PropertyRow({ items, testId }: { items: Property[]; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
    >
      {items.map((property) => (
        <div
          key={property.id}
          data-testid="tenant-home-card"
          className="min-w-[260px] max-w-[280px] flex-1"
        >
          <PropertyCard property={property} href={`/properties/${property.id}`} />
        </div>
      ))}
    </div>
  );
}

function CityTiles({ cities }: { cities: ReturnType<typeof getCityCollections> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((city) => (
        <Link
          key={city.city}
          href={`/properties?city=${encodeURIComponent(city.city)}`}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Explore</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{city.city}</p>
          <p className="text-sm text-slate-600">{city.caption}</p>
        </Link>
      ))}
    </div>
  );
}

export default async function TenantHomePage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Tenant home</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so discovery is unavailable right now.
        </p>
      </div>
    );
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    logAuthRedirect("/tenant/home");
    redirect("/auth/login?reason=auth");
  }
  if (!role) {
    redirect("/onboarding");
  }
  if (role !== "tenant") {
    redirect(role === "admin" ? "/admin/support" : "/host");
  }

  const context = await getTenantDiscoveryContext();
  const cityCollections = getCityCollections();
  const fallbackCity = cityCollections[0]?.city ?? null;

  let jurisdictionCode = context.profileJurisdiction ?? null;
  if (!jurisdictionCode) {
    jurisdictionCode = await resolveJurisdiction({
      userId: user.id,
      supabase: context.supabase,
    });
  }

  const jurisdictionName = getCountryByCode(jurisdictionCode)?.name ?? jurisdictionCode;
  const popularCity =
    context.profileCity ??
    (jurisdictionCode ? DEFAULT_CITY_BY_JURISDICTION[jurisdictionCode] : null) ??
    fallbackCity;

  const popularHeading = popularCity
    ? `Popular in ${popularCity}`
    : jurisdictionName
      ? `Popular in ${jurisdictionName}`
      : "Popular homes";

  const [featuredHomes, popularHomes, newHomes] = await Promise.all([
    getFeaturedHomes({ limit: MODULE_LIMIT, context }),
    getPopularHomes({ city: popularCity, limit: MODULE_LIMIT, context }),
    getNewHomes({ days: 7, limit: MODULE_LIMIT, context }),
  ]);

  let fallbackHomes: Property[] = [];
  const hasModules =
    featuredHomes.length > 0 || popularHomes.length > 0 || newHomes.length > 0;

  if (!hasModules) {
    fallbackHomes = await getFallbackHomes({ limit: 9, context });
  }

  if (DEV_MOCKS) {
    if (!featuredHomes.length) {
      featuredHomes.push(...mockProperties.slice(0, 4));
    }
    if (!popularHomes.length) {
      popularHomes.push(...mockProperties.slice(1, 5));
    }
    if (!newHomes.length) {
      newHomes.push(...mockProperties.slice(2, 6));
    }
    if (!fallbackHomes.length && !hasModules) {
      fallbackHomes = mockProperties.slice(0, 6);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 text-white shadow-xl md:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.35),transparent_40%),radial-gradient(circle_at_80%_0,rgba(56,189,248,0.25),transparent_30%)]" />
        <div className="relative grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Tenant Home
            </p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              Find your next home
            </h1>
            <p className="text-base text-slate-200">
              Search by city, area, or landmark. Save what you like and pick up the conversation when you’re ready.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <span className="rounded-full bg-white/10 px-3 py-1">Verified hosts</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Secure messaging</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Saved search alerts</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/95 p-4 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.3)]">
            <SmartSearchBox mode="browse" />
          </div>
        </div>
      </section>

      {featuredHomes.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-featured">
          <SectionHeader
            title="Featured homes"
            description="Premium placement from verified hosts and agents."
            href="/properties?featured=true"
          />
          <PropertyRow items={featuredHomes} testId="tenant-home-featured-row" />
        </section>
      )}

      {popularHomes.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-popular">
          <SectionHeader
            title={popularHeading}
            description="Homes tenants are engaging with right now."
            href={popularCity ? `/properties?city=${encodeURIComponent(popularCity)}` : "/properties"}
          />
          <PropertyRow items={popularHomes} testId="tenant-home-popular-row" />
        </section>
      )}

      {newHomes.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-new">
          <SectionHeader
            title="New this week"
            description="Fresh listings added in the last 7 days."
            href="/properties?recent=7"
          />
          <PropertyRow items={newHomes} testId="tenant-home-new-row" />
        </section>
      )}

      {cityCollections.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-cities">
          <SectionHeader
            title="Explore by city"
            description="Browse curated neighbourhoods and popular districts."
          />
          <CityTiles cities={cityCollections} />
        </section>
      )}

      {!hasModules && (
        <section className="space-y-4" data-testid="tenant-home-fallback">
          <SectionHeader
            title="Browse all homes"
            description="No featured modules yet — explore everything available."
            href="/properties"
          />
          {fallbackHomes.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="tenant-home-fallback-grid">
              {fallbackHomes.map((property) => (
                <div key={property.id} data-testid="tenant-home-card">
                  <PropertyCard
                    property={property}
                    href={`/properties/${property.id}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Check back soon</h3>
              <p className="mt-2 text-sm text-slate-600">
                We’re still onboarding listings in your area. Save a search and we’ll notify you when new homes go live.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link href="/properties">
                  <Button variant="secondary">Browse listings</Button>
                </Link>
                <Link href="/tenant/saved-searches">
                  <Button>Save a search</Button>
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
