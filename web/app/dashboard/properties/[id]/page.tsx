import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyStepper } from "@/components/properties/PropertyStepper";
import { HostFixRequestPanel } from "@/components/host/HostFixRequestPanel";
import { getApiBaseUrl } from "@/lib/env";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { resolveServerRole } from "@/lib/auth/role";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { canManageListings } from "@/lib/role-access";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";
import { cookies } from "next/headers";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { normalizeFocusParam, normalizeStepParam, type StepId } from "@/lib/properties/step-params";
import { isListingExpired } from "@/lib/properties/expiry";
import { RenewListingButton } from "@/components/host/RenewListingButton";

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
    const cookieHeader = (await cookies()).toString();
    const listRes = await fetch(listUrl, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (listRes.ok) {
      const json = await listRes.json();
      const all = (json.properties as Property[]) || [];
      const found = all.find((p) => p.id === cleanId);
      if (found) {
        console.log("[dashboard edit] fetched via list", { id: cleanId, listUrl });
        const typed = found as Property & {
          property_images?: Array<{ id: string; image_url: string }>;
          property_videos?: Array<{
            id: string;
            video_url: string;
            storage_path?: string | null;
            bytes?: number | null;
            format?: string | null;
          }>;
        };
        const withImages: Property = {
          ...typed,
          images: typed.property_images?.map((img) => ({
            id: img.id,
            image_url: img.image_url,
          })),
          property_videos: typed.property_videos ?? null,
        };
        return { property: withImages, error: null };
      }
    } else {
      console.warn("[dashboard edit] list fetch failed", { status: listRes.status });
    }

    // Fallback to detail API for completeness (e.g., non-public records)
    const detailUrl = `${apiBaseUrl}/api/properties/${cleanId}?scope=own`;
    const res = await fetch(detailUrl, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (res.ok) {
      const json = await res.json();
      const data = json.property as Property & {
        property_images?: Array<{ id: string; image_url: string }>;
        property_videos?: Array<{
          id: string;
          video_url: string;
          storage_path?: string | null;
          bytes?: number | null;
          format?: string | null;
        }>;
      };
      if (data) {
        console.log("[dashboard edit] fetched via detail API", { id: cleanId, detailUrl });
        const withImages: Property = {
          ...data,
          images: data.property_images?.map((img) => ({
            id: img.id,
            image_url: img.image_url,
          })),
          property_videos: data.property_videos ?? null,
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
    const { supabase, user } = await getServerAuthUser();
    if (!user) {
      return { property: null, error: "Unauthorized" };
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin = profile?.role === "admin";

    let query = supabase
      .from("properties")
      .select(
        "*, property_images(image_url,id), property_videos(id, video_url, storage_path, bytes, format, created_at, updated_at), shortlet_settings(property_id,booking_mode,nightly_price_minor)"
      )
      .eq("id", cleanId);

    if (!isAdmin) {
      query = query.eq("owner_id", user.id);
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      const typed = data as Property & {
        property_images?: Array<{ id: string; image_url: string }>;
        property_videos?: Array<{
          id: string;
          video_url: string;
          storage_path?: string | null;
          bytes?: number | null;
          format?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        }>;
      };
      const withImages: Property = {
        ...typed,
        images: typed.property_images?.map((img) => ({
          id: img.id,
          image_url: img.image_url,
        })),
        property_videos: typed.property_videos ?? null,
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

function resolveStep(searchParams?: Props["searchParams"]): StepId {
  const raw = searchParams?.step;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return normalizeStepParam(value);
}

function resolveFocus(searchParams?: Props["searchParams"]): "location" | "photos" | null {
  const raw = searchParams?.focus;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return normalizeFocusParam(value);
}

export default async function EditPropertyPage({ params, searchParams }: Props) {
  const { user, role } = await resolveServerRole();
  if (!user) {
    logAuthRedirect("/dashboard/properties/[id]");
    redirect("/auth/login?reason=auth");
  }
  if (!role) {
    redirect("/onboarding");
  }
  if (!canManageListings(role)) {
    redirect("/tenant/home");
  }
  const enableLocationPicker = await getAppSettingBool("enable_location_picker", false);
  const requireLocationPinForPublish = await getAppSettingBool(
    "require_location_pin_for_publish",
    false
  );
  const initialStep = resolveStep(searchParams);
  const initialFocus = resolveFocus(searchParams);

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
    const showDiagnostics = process.env.NODE_ENV === "development";
    const normalizedError = fetchError?.toLowerCase() ?? "";
    const invalidLink =
      normalizedError.includes("invalid property id") ||
      normalizedError.includes("invalid input syntax") ||
      normalizedError.includes("uuid");
    const userMessage = invalidLink
      ? "This listing link looks invalid. Please open it again from your dashboard."
      : "This listing doesn't exist or could not be loaded. Please pick another from your dashboard.";
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Listing not found
          </h1>
          <p className="text-sm text-slate-600">
            {userMessage}
          </p>
          {fetchError && showDiagnostics && (
            <p className="text-xs text-amber-700">Diagnostics: {fetchError}</p>
          )}
        </div>
        <Link href="/dashboard" className="text-sky-700 font-semibold">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const isExpired = isListingExpired(property);

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
      {isExpired && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div>
            <p className="font-semibold">This listing has expired.</p>
            <p className="mt-1">This listing has expired and is no longer visible to tenants.</p>
          </div>
          {property.id && <RenewListingButton propertyId={property.id} size="sm" />}
        </div>
      )}
      {property.id && property.status === ("changes_requested" as Property["status"]) && (
        <HostFixRequestPanel
          key={`${property.id}-${(property as { rejection_reason?: string | null })?.rejection_reason ?? ""}`}
          propertyId={property.id}
          status={property.status}
          rejectionReason={(property as { rejection_reason?: string | null })?.rejection_reason ?? null}
          updatedAt={property.updated_at}
        />
      )}
      <PropertyStepper
        initialData={property}
        initialStep={initialStep}
        initialFocus={initialFocus}
        enableLocationPicker={enableLocationPicker}
        requireLocationPinForPublish={requireLocationPinForPublish}
      />
    </div>
  );
}
