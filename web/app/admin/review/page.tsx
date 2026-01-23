import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReviewDesk } from "@/components/admin/AdminReviewDesk";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import { buildSelectedUrl, type AdminReviewListItem } from "@/lib/admin/admin-review";
import { computeListingReadiness } from "@/lib/properties/listing-readiness";
import type { PropertyImage } from "@/lib/types";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { formatRoleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type RawProperty = {
  id: string;
  title: string | null;
  city?: string | null;
  state_region?: string | null;
  country_code?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  owner_id?: string | null;
  status?: string | null;
  cover_image_url?: string | null;
  photo_count?: number | null;
  has_cover?: boolean | null;
  property_images?: Array<{ image_url: string; width?: number | null; height?: number | null }>;
  property_videos?: Array<{ id: string }>;
  admin_area_1?: string | null;
  admin_area_2?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
};

async function loadReviewListings(): Promise<AdminReviewListItem[]> {
  if (!hasServerSupabaseEnv()) return [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data: properties } = await supabase
      .from("properties")
      .select(
        [
          "id",
          "title",
          "city",
          "state_region",
          "country_code",
          "updated_at",
          "created_at",
          "owner_id",
          "status",
          "cover_image_url",
          "photo_count",
          "has_cover",
          "property_images(id,image_url,width,height)",
          "property_videos(id)",
        ].join(",")
      )
      .in("status", ["pending", "changes_requested", "live", "approved"])
      .order("updated_at", { ascending: false });

    const rawProperties = (properties as RawProperty[] | null) || [];
    const ownerIds = Array.from(new Set(rawProperties.map((p) => p.owner_id).filter(Boolean))) as string[];
    let owners: Record<string, string> = {};
    if (ownerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", ownerIds);
      owners = Object.fromEntries(
        (profiles || [])
          .map((p) => [p.id, p.full_name || formatRoleLabel(p.role as string | undefined) || "Host"])
      );
    }

    return rawProperties.map((p) => {
      const images: PropertyImage[] = (p.property_images || []).map((img, idx) => ({
        id: (img as { id?: string }).id || `img-${idx}`,
        image_url: img.image_url,
        width: img.width ?? undefined,
        height: img.height ?? undefined,
        position: idx,
        property_id: p.id,
        created_at: p.created_at || undefined,
      }));
      const readinessInput = {
        ...(p as RawProperty),
        images,
      } as Parameters<typeof computeListingReadiness>[0];
      const readiness = computeListingReadiness(readinessInput);
      const locationQuality = computeLocationQuality({
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        location_label: p.location_label ?? null,
        location_place_id: p.location_place_id ?? null,
        country_code: p.country_code ?? null,
        admin_area_1: p.admin_area_1 ?? p.state_region ?? null,
        admin_area_2: p.admin_area_2 ?? null,
        postal_code: p.postal_code ?? null,
        city: p.city ?? null,
      });

      return {
        id: p.id,
        title: p.title || "Untitled",
        hostName: owners[p.owner_id || ""] || "Host",
        updatedAt: p.updated_at || p.created_at || null,
        status: p.status ?? "pending",
        city: p.city ?? null,
        state_region: p.state_region ?? null,
        country_code: p.country_code ?? null,
        readiness,
        locationQuality: locationQuality.quality,
        photoCount: typeof p.photo_count === "number" ? p.photo_count : (p.property_images || []).length,
        hasVideo: Array.isArray(p.property_videos) && p.property_videos.length > 0,
      };
    });
  } catch (err) {
    console.warn("admin review desk fetch failed", err);
    return [];
  }
}

export default async function AdminReviewPage({ searchParams }: Props) {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/login?reason=auth");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden");
  }

  const listings = await loadReviewListings();
  const initialSelectedId = (() => {
    const raw = searchParams?.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? decodeURIComponent(value) : null;
  })();

  const pathname = "/admin/review";
  const canonicalUrl = initialSelectedId ? buildSelectedUrl(pathname, initialSelectedId) : pathname;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{ADMIN_REVIEW_COPY.headerTitle}</h1>
          <p className="text-sm text-slate-600">{ADMIN_REVIEW_COPY.headerSubtitle}</p>
        </div>
        <Link href="/admin" className="text-sm text-sky-600 hover:text-sky-700">
          Back to Admin
        </Link>
      </div>
      <AdminReviewDesk listings={listings} initialSelectedId={initialSelectedId} />
      <link rel="canonical" href={canonicalUrl} />
    </div>
  );
}
