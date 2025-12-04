import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { mockProperties } from "@/lib/mock";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const supabaseReady = hasServerSupabaseEnv();
  let properties: Property[] = mockProperties;

  if (supabaseReady) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/properties`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const typed =
          (json.properties as Array<Property & { property_images?: Array<{ id: string; image_url: string }> }>) ||
          [];
        properties =
          typed.map((row) => ({
            ...row,
            images: row.property_images?.map((img) => ({ id: img.id, image_url: img.image_url })),
          })) || [];
      }
    } catch (err) {
      console.warn("Dashboard properties fallback to mock", err);
    }
  }

  const demoMode = !properties.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My properties</h2>
          <p className="text-sm text-slate-600">
            Listings you own. Approvals required for public visibility.
          </p>
          {demoMode && (
            <p className="text-xs text-amber-700">
              Demo data shown until Supabase is connected.
            </p>
          )}
        </div>
        <Link href="/dashboard/properties/new">
          <Button>New listing</Button>
        </Link>
      </div>
      <div className="space-y-3">
        {demoMode && (
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Running in demo mode. Connect Supabase and sign in to manage your own listings.
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
              Publish your first property or use the demo data while you set up Supabase.
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
