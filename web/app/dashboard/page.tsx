import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const supabaseReady = hasServerSupabaseEnv();
  let properties: Property[] = [];
  let fetchError: string | null = null;

  if (supabaseReady) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        fetchError = "Unauthorized";
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        const isAdmin = profile?.role === "admin";
        let query = supabase
          .from("properties")
          .select("*, property_images(image_url,id)")
          .order("created_at", { ascending: false });
        if (!isAdmin) {
          query = query.eq("owner_id", user.id);
        }
        const { data, error } = await query;
        if (error) {
          fetchError = error.message;
        } else {
          const typed =
            (data as Array<Property & { property_images?: Array<{ id: string; image_url: string }> }>) ||
            [];
          properties =
            typed.map((row) => ({
              ...row,
              images: row.property_images?.map((img) => ({ id: img.id, image_url: img.image_url })),
            })) || [];
        }
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
