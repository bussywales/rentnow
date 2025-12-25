export const dynamic = "force-dynamic";

import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapClient } from "@/components/properties/PropertyMapClient";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getApiBaseUrl, getEnvPresence } from "@/lib/env";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { mockProperties } from "@/lib/mock";
import type { Property } from "@/lib/types";

export default async function Home() {
  let featured: Property[] = [];
  const apiBaseUrl = getApiBaseUrl();
  const apiUrl = `${apiBaseUrl}/api/properties`;
  const supabaseReady = hasServerSupabaseEnv();
  const allowDemo = process.env.NODE_ENV !== "production";
  const envPresence = getEnvPresence();
  let fetchError: string | null = null;

  if (supabaseReady) {
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (!res.ok) {
        fetchError = `API responded with ${res.status}`;
      } else {
        const json = await res.json();
        const typed =
          (json.properties as Array<Property & { property_images?: Array<{ id: string; image_url: string }> }>) ||
          [];
      featured =
        typed
          .map((row) => ({
            ...row,
            images: row.property_images?.map((img) => ({
              id: img.id,
              image_url: img.image_url,
            })),
          }))
          .slice(0, 3) || [];
        if (!featured.length) {
          fetchError = "No properties returned from API.";
        }
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Unknown error";
      console.warn("[home] unable to fetch featured properties", err);
    }
  } else {
    fetchError = "Supabase env vars missing; configure NEXT_PUBLIC_SITE_URL and Supabase keys.";
  }

  if (allowDemo && (!supabaseReady || !featured.length)) {
    featured = mockProperties.slice(0, 3);
  }

  const hubs = [
    { city: "Lagos", caption: "Island - Ikoyi - Lekki" },
    { city: "Nairobi", caption: "Kilimani - Westlands" },
    { city: "Accra", caption: "East Legon - Airport" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.3),transparent_35%),radial-gradient(circle_at_80%_0,rgba(56,189,248,0.25),transparent_25%)]" />
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Rentals x Africa x AI
            </p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Rent faster with a map-first, AI-guided experience.
            </h1>
            <p className="text-lg text-slate-200">
              Landlords list in minutes. Tenants search by city, price, and vibe. Messaging, viewings, and AI descriptions are ready out of the box.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/auth/register">
                <Button>Get started</Button>
              </Link>
              <Link href="/properties">
                <Button variant="secondary">Browse properties</Button>
              </Link>
            </div>
          </div>
          <div className="glass relative rounded-2xl p-5 text-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Quick search
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  Find your next stay
                </p>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                PWA ready
              </span>
            </div>
            <form className="space-y-3" action="/properties" method="get">
              <Input name="city" placeholder="City or neighbourhood" />
              <div className="grid grid-cols-2 gap-3">
                <Input name="minPrice" type="number" placeholder="Min price" />
                <Input name="maxPrice" type="number" placeholder="Max price" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select name="rentalType" defaultValue="">
                  <option value="">Any rental type</option>
                  <option value="short_let">Short-let</option>
                  <option value="long_term">Long-term</option>
                </Select>
                <Input name="bedrooms" type="number" placeholder="Bedrooms" />
              </div>
              <Button type="submit" className="w-full">
                Search rentals
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {hubs.map((hub) => (
          <div
            key={hub.city}
            className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Featured hub
            </p>
            <p className="text-xl font-semibold text-slate-900">{hub.city}</p>
            <p className="text-sm text-slate-600">{hub.caption}</p>
            <Link
              href={`/properties?city=${encodeURIComponent(hub.city)}`}
              className="mt-3 inline-flex text-sm font-semibold text-sky-700"
            >
              Browse {hub.city}
            </Link>
          </div>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <SmartSearchBox />
        </div>
        <div className="md:col-span-2 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">How it works</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>1) Sign up and choose a role: tenant, landlord, agent.</li>
            <li>2) Landlords: create a listing, upload photos, generate AI copy.</li>
            <li>3) Tenants: search, save favourites, message hosts, request viewings.</li>
            <li>4) Admin: approve listings. Everything lives on Supabase.</li>
          </ul>
          <div className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-100">
            <p className="font-semibold text-white">Tech stack</p>
            <p>Next.js App Router / Supabase / Tailwind / Leaflet / OpenAI</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Featured properties
            </h2>
            <p className="text-sm text-slate-600">
              A taste of what landlords and agents can publish.
            </p>
          </div>
          <Link href="/dashboard/properties/new" className="text-sm font-semibold text-sky-600">
            {"List a property ->"}
          </Link>
        </div>
        {featured.length ? (
          <div className="grid gap-5 md:grid-cols-3">
            {featured.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                href={`/properties/${property.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="text-base font-semibold">Unable to load featured listings</p>
            <p className="mt-1 text-sm text-amber-800">
              {fetchError ?? "Live listings are unavailable right now."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <form action="/">
                <Button type="submit" size="sm" variant="secondary">
                  Retry
                </Button>
              </form>
              <Link href="/properties" className="text-sm font-semibold text-amber-900 underline-offset-4 hover:underline">
                Browse all listings
              </Link>
            </div>
            <div className="mt-3 rounded-lg bg-amber-100/70 p-3 text-xs text-amber-900">
              <p className="font-semibold">Diagnostics</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono">
                {JSON.stringify(
                  { apiUrl, supabaseReady, env: envPresence },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Map preview</h2>
          <Link href="/properties" className="text-sm font-semibold text-sky-600">
            {"Open full map ->"}
          </Link>
        </div>
        <PropertyMapClient properties={featured} height="360px" />
      </section>
    </div>
  );
}
