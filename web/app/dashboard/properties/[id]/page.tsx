import Link from "next/link";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { getSiteUrl } from "@/lib/env";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

function normalizeId(id: string) {
  return decodeURIComponent(id).trim();
}

async function loadProperty(id: string): Promise<Property | null> {
  const cleanId = normalizeId(id);

  // First try the public API (works for anon/demo)
  try {
    const baseUrl = getSiteUrl();
    const detailUrl = `${baseUrl}/api/properties/${cleanId}`;
    const res = await fetch(detailUrl, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const data = json.property as Property & {
        property_images?: Array<{ id: string; image_url: string }>;
      };
      if (data) {
        return {
          ...data,
          images: data.property_images?.map((img) => ({
            id: img.id,
            image_url: img.image_url,
          })),
        };
      }
    } else {
      // If direct fetch fails (e.g., RLS/session), try listing endpoint then filter.
      const listRes = await fetch(`${baseUrl}/api/properties`, { cache: "no-store" });
      if (listRes.ok) {
        const json = await listRes.json();
        const all = (json.properties as Property[]) || [];
        const found = all.find((p) => p.id === cleanId);
        if (found) return found;
      }
    }
  } catch (err) {
    console.warn("Dashboard edit API fetch failed", err);
  }

  if (!hasServerSupabaseEnv()) {
    return null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(image_url,id)")
      .eq("id", cleanId)
      .maybeSingle();
    if (!error && data) {
      const typed = data as Property & {
        property_images?: Array<{ id: string; image_url: string }>;
      };
      return {
        ...typed,
        images: typed.property_images?.map((img) => ({
          id: img.id,
          image_url: img.image_url,
        })),
      };
    }
  } catch (err) {
    console.warn("Supabase not configured for dashboard edit", err);
  }

  return null;
}

export default async function EditPropertyPage({ params }: Props) {
  let property: Property | null = null;
  let fetchError: string | null = null;
  try {
    property = await loadProperty(params.id);
  } catch (err) {
    console.error("Failed to load property for dashboard edit", err);
    property = null;
    fetchError = err instanceof Error ? err.message : "Unknown error";
  }

  if (!property) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Listing not found
          </h1>
          <p className="text-sm text-slate-600">
            This listing doesn&apos;t exist or could not be loaded. Please pick another from your dashboard.
          </p>
          {fetchError && (
            <p className="text-xs text-amber-700">Error: {fetchError}</p>
          )}
          {!fetchError && (
            <p className="text-xs text-slate-500">
              Ensure the listing id is approved/active and visible via /api/properties.
            </p>
          )}
        </div>
        <Link href="/dashboard" className="text-sky-700 font-semibold">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Edit listing
        </h1>
        <p className="text-sm text-slate-600">
          Update details, tweak pricing, or generate fresh AI copy.
        </p>
      </div>
      <PropertyForm initialData={property} />
    </div>
  );
}
