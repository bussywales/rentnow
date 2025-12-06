import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { getSiteUrl } from "@/lib/env";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const supabaseReady = hasServerSupabaseEnv();
  const baseUrl = getSiteUrl();
  let properties: Property[] = [];
  let fetchError: string | null = null;

  if (supabaseReady) {
    try {
      const res = await fetch(`${baseUrl}/api/properties?scope=own`, {
        cache: "no-store",
      });
      if (!res.ok) {
        fetchError = `API responded with ${res.status}`;
      } else {
        const json = await res.json();
        const typed =
          (json.properties as Array<Property & { property_images?: Array<{ id: string; image_url: string }> }>) ||
          [];
        properties =
          typed.map((row) => ({
            ...row,
            images: row.property_images?.map((img) => ({ id: img.id, image_url: img.image_url })),
          })) || [];
        console.log("[dashboard] fetched properties", {
          count: properties.length,
          apiUrl: `${baseUrl}/api/properties?scope=own`,
        });
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Unknown error while fetching properties";
    }
  } else {
    fetchError = "Supabase env vars missing; add NEXT_PUBLIC_SITE_URL and Supabase keys.";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My properties</h2>
          <p className="text-sm text-slate-600">
            Listings you own. Approvals required for public visibility.
          </p>
        </div>
        <Link href="/dashboard/properties/new">
          <Button>New listing</Button>
        </Link>
      </div>
      <div className="space-y-3">
        {fetchError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {fetchError}
          </div>
        )}

        {properties.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                compact
                href={`/dashboard/properties/${property.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <p className="text-base font-semibold text-slate-900">No listings yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Publish your first property to see it here. Ensure Supabase env vars are set in Vercel.
            </p>
            <Link href="/dashboard/properties/new" className="mt-3 inline-flex">
              <Button size="sm">Create listing</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
