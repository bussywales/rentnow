import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { mockProperties } from "@/lib/mock";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const supabaseReady = hasServerSupabaseEnv();
  const loadProperties = async (): Promise<{ userId: string | null; properties: Property[] }> => {
    if (!supabaseReady) {
      return { userId: null, properties: mockProperties };
    }

    try {
      const supabase = createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { userId: null, properties: mockProperties };
      }

      const { data, error } = await supabase
        .from("properties")
        .select("*, property_images(image_url,id)")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Failed to load Supabase properties; using mock data", error);
        return { userId: user.id, properties: mockProperties };
      }

      const typed = (data as Array<Property & { property_images?: Array<{ id: string; image_url: string }> }>) || [];
      const mapped =
        typed.map((row) => ({
          ...row,
          images: row.property_images?.map((img) => ({ id: img.id, image_url: img.image_url })),
        })) || [];

      return {
        userId: user.id,
        properties: mapped.length ? mapped : mockProperties,
      };
    } catch (err) {
      console.warn("Dashboard properties fallback to mock", err);
      return { userId: null, properties: mockProperties };
    }
  };

  const { properties, userId } = await loadProperties();
  const demoMode = !userId;

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
