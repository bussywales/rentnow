import Link from "next/link";
import { PropertyStepper } from "@/components/properties/PropertyStepper";
import { getApiBaseUrl } from "@/lib/env";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { id?: string };
type Props = {
  params: Params | Promise<Params>;
  searchParams?: Record<string, string | string[] | undefined>;
};

function normalizeId(id: string) {
  return decodeURIComponent(id).trim();
}

function extractId(raw: Params | Promise<Params>): Promise<string | undefined> {
  const maybePromise = raw as Promise<Params>;
  const isPromise = typeof (maybePromise as { then?: unknown }).then === "function";
  if (isPromise) {
    return maybePromise.then((p) => p?.id);
  }
  return Promise.resolve((raw as Params)?.id);
}

async function loadProperty(id: string | undefined): Promise<{ property: Property | null; error: string | null }> {
  if (!id) {
    return { property: null, error: "Invalid property id" };
  }
  const cleanId = normalizeId(id);
  if (!cleanId || cleanId === "undefined" || cleanId === "null") {
    return { property: null, error: "Invalid property id" };
  }

  // First try the list API (most permissive, no per-id RLS surprises)
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const listUrl = `${apiBaseUrl}/api/properties?scope=own`;
    const listRes = await fetch(listUrl, { cache: "no-store" });
    if (listRes.ok) {
      const json = await listRes.json();
      const all = (json.properties as Property[]) || [];
      const found = all.find((p) => p.id === cleanId);
      if (found) {
        console.log("[dashboard edit] fetched via list", { id: cleanId, listUrl });
        return { property: found, error: null };
      }
    } else {
      console.warn("[dashboard edit] list fetch failed", { status: listRes.status });
    }

    // Fallback to detail API for completeness (e.g., non-public records)
    const detailUrl = `${apiBaseUrl}/api/properties/${cleanId}?scope=own`;
    const res = await fetch(detailUrl, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const data = json.property as Property & {
        property_images?: Array<{ id: string; image_url: string }>;
      };
      if (data) {
        console.log("[dashboard edit] fetched via detail API", { id: cleanId, detailUrl });
        const withImages: Property = {
          ...data,
          images: data.property_images?.map((img) => ({
            id: img.id,
            image_url: img.image_url,
          })),
        };
        return { property: withImages, error: null };
      }
    } else {
      console.warn("[dashboard edit] detail fetch failed", { status: res.status, detailUrl });
    }
  } catch (err) {
    console.warn("Dashboard edit API fetch failed", err);
  }

  if (!hasServerSupabaseEnv()) {
    return { property: null, error: "Supabase env missing" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    const isAdmin = profile?.role === "admin";

    let query = supabase
      .from("properties")
      .select("*, property_images(image_url,id)")
      .eq("id", cleanId);

    if (!isAdmin) {
      query = query.eq("owner_id", user?.id ?? "");
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      const typed = data as Property & {
        property_images?: Array<{ id: string; image_url: string }>;
      };
      const withImages: Property = {
        ...typed,
        images: typed.property_images?.map((img) => ({
          id: img.id,
          image_url: img.image_url,
        })),
      };
      return { property: withImages, error: null };
    }
    if (error) {
      return { property: null, error: error.message };
    }
  } catch (err) {
    console.warn("Supabase dashboard edit fetch failed", err);
    return { property: null, error: err instanceof Error ? err.message : "Supabase error" };
  }

  return { property: null, error: "Unknown error" };
}

function resolveStep(searchParams?: Props["searchParams"]) {
  const raw = searchParams?.step;
  const value = Array.isArray(raw) ? raw[0] : raw;
  switch (value) {
    case "details":
      return 1;
    case "photos":
      return 2;
    case "preview":
      return 3;
    case "submit":
      return 4;
    default:
      return 0;
  }
}

export default async function EditPropertyPage({ params, searchParams }: Props) {
  let property: Property | null = null;
  let fetchError: string | null = null;
  try {
    const id = await extractId(params);
    const result = await loadProperty(id);
    property = result.property;
    fetchError = result.error;
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
      <PropertyStepper initialData={property} initialStep={resolveStep(searchParams)} />
    </div>
  );
}
