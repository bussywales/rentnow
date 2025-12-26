import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type PropertyStatus = "draft" | "pending" | "live" | "rejected" | "paused";

function normalizeStatus(property: Property): PropertyStatus {
  if (property.status) return property.status as PropertyStatus;
  if (property.is_approved && property.is_active) return "live";
  if (!property.is_approved && property.is_active) return "pending";
  return "draft";
}

function qualityScore(property: Property) {
  let score = 0;
  if (property.title) score += 20;
  if (property.price) score += 15;
  if ((property.description || "").length >= 120) score += 25;
  if ((property.images || []).length >= 3) score += 25;
  if ((property.amenities || []).length >= 3) score += 15;
  return Math.min(score, 100);
}

async function submitForApproval(id: string) {
  "use server";
  if (!hasServerSupabaseEnv()) return;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.owner_id !== user.id) return;

  await supabase
    .from("properties")
    .update({
      status: "pending",
      is_active: true,
      is_approved: false,
      submitted_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id);

  revalidatePath("/dashboard");
}

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
          .select("*, property_images(image_url,id,position)")
          .order("created_at", { ascending: false })
          .order("position", { foreignTable: "property_images", ascending: true });
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
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My properties</h2>
          <p className="text-sm text-slate-600">
            Listings you own. Approvals required for public visibility.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/properties/new">
            <Button>New listing</Button>
          </Link>
        </div>
      </div>

      {properties.some((property) => normalizeStatus(property) === "rejected") && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">One or more listings were rejected.</p>
          <p className="mt-1">
            Review the rejection reason and update the listing before resubmitting.
          </p>
        </div>
      )}

      {properties.some((property) => {
        if (normalizeStatus(property) !== "live") return false;
        if (!property.approved_at) return false;
        const approvedAt = new Date(property.approved_at).getTime();
        return Number.isFinite(approvedAt) && Date.now() - approvedAt < 7 * 24 * 3600 * 1000;
      }) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">Your listing was approved.</p>
          <p className="mt-1">Great news — your property is live and visible to tenants.</p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Getting approved faster
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>Upload at least 3 high-quality photos.</li>
          <li>Write a 120+ character description.</li>
          <li>Confirm rent, availability, and contact details.</li>
        </ul>
      </div>
      <div className="space-y-3">
        {fetchError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {fetchError}
          </div>
        )}

        {properties.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((property) => {
              const status = normalizeStatus(property);
              const score = qualityScore(property);
              const hasPhotos = (property.images || []).length > 0;
              return (
                <div
                  key={property.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {status}
                    </span>
                    {status === "draft" && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        Continue draft
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <PropertyCard
                      property={property}
                      compact
                      href={`/dashboard/properties/${property.id}`}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                    <span>Quality score</span>
                    <span className="font-semibold text-slate-900">{score}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-sky-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  {property.rejection_reason && status === "rejected" && (
                    <p className="mt-2 text-xs text-rose-600">
                      Rejection reason: {property.rejection_reason}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/dashboard/properties/${property.id}`}>
                      <Button size="sm" variant="secondary">
                        Edit listing
                      </Button>
                    </Link>
                    {!hasPhotos && (
                      <Link href={`/dashboard/properties/${property.id}?step=photos`}>
                        <Button size="sm" variant="secondary">
                          Add photos
                        </Button>
                      </Link>
                    )}
                    {status === "draft" || status === "paused" || status === "rejected" ? (
                      <form action={submitForApproval.bind(null, property.id)}>
                        <Button size="sm" type="submit">
                          Submit for approval
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
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
