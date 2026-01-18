import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { getUserRole } from "@/lib/authz";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";
import { getPlanForTier, isListingLimitReached } from "@/lib/plans";
import { logPlanLimitHit } from "@/lib/observability";
import { revalidatePath } from "next/cache";
import { TrustBadges } from "@/components/trust/TrustBadges";
import { TrustReliability } from "@/components/trust/TrustReliability";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { orderImagesWithCover } from "@/lib/properties/images";

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
  const { supabase, user } = await getServerAuthUser();
  if (!user) return;

  const role = await getUserRole(supabase, user.id);
  if (!role) return;

  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (!allowed) return;
      ownerId = actingAs;
    }
  }

  const { data: existing } = await supabase
    .from("properties")
    .select("owner_id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.owner_id !== ownerId) return;

  const willActivate = !existing.is_active;
  if (willActivate && role !== "admin") {
    const serviceClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
    const usage = await getPlanUsage({
      supabase,
      ownerId,
      serviceClient,
      excludeId: id,
    });
    if (!usage.error && usage.activeCount >= usage.plan.maxListings) {
      logPlanLimitHit({
        route: "dashboard/submitForApproval",
        actorId: user.id,
        ownerId,
        planTier: usage.plan.tier,
        maxListings: usage.plan.maxListings,
        activeCount: usage.activeCount,
        propertyId: id,
        source: usage.source,
      });
      return;
    }
  }

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

  revalidatePath("/host");
}

async function requestUpgrade() {
  "use server";
  if (!hasServerSupabaseEnv()) return;
  const { supabase, user } = await getServerAuthUser();
  if (!user) return;

  const role = await getUserRole(supabase, user.id);
  if (!role || (role !== "landlord" && role !== "agent")) return;

  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (!allowed) return;
      ownerId = actingAs;
    }
  }

  const { data: existing } = await supabase
    .from("plan_upgrade_requests")
    .select("id")
    .eq("profile_id", ownerId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return;

  await supabase.from("plan_upgrade_requests").insert({
    profile_id: ownerId,
    requester_id: user.id,
    requested_plan_tier: "starter",
    status: "pending",
  });

  revalidatePath("/host");
}

export default async function DashboardHome() {
  const supabaseReady = hasServerSupabaseEnv();
  let properties: Property[] = [];
  let fetchError: string | null = null;
  let role: string | null = null;
  let planTier: string | null = null;
  let maxOverride: number | null = null;
  let validUntil: string | null = null;
  let pendingUpgrade = false;
  let trustMarkers: TrustMarkerState | null = null;

  if (supabaseReady) {
    try {
      const { supabase, user } = await getServerAuthUser();
      if (!user) {
        fetchError = "Unauthorized";
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "role, email_verified, phone_verified, bank_verified, reliability_power, reliability_water, reliability_internet, trust_updated_at"
          )
          .eq("id", user.id)
          .maybeSingle();
        role = profile?.role ?? null;
        trustMarkers = (profile as TrustMarkerState | null) ?? null;
        if (!role) {
          redirect("/onboarding");
        }
        if (role === "tenant") {
          redirect("/tenant");
        }
        if (role === "admin") {
          redirect("/admin/support");
        }
        const isAdmin = role === "admin";
        let ownerId = user.id;
        if (role === "agent") {
          const actingAs = await readActingAsFromCookies();
          if (actingAs && actingAs !== user.id) {
            const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
            if (allowed) {
              ownerId = actingAs;
            }
          }
        }
        const missingPosition = (message?: string | null) =>
          typeof message === "string" &&
          message.includes("position") &&
          message.includes("property_images");
        const buildQuery = (includePosition: boolean) => {
          const imageFields = includePosition
            ? "image_url,id,position,created_at"
            : "image_url,id,created_at";
          let query = supabase
            .from("properties")
            .select(`*, property_images(${imageFields})`)
            .order("created_at", { ascending: false });
          if (includePosition) {
            query = query.order("position", {
              foreignTable: "property_images",
              ascending: true,
            })
            .order("created_at", {
              foreignTable: "property_images",
              ascending: true,
            });
          } else {
            query = query.order("created_at", {
              foreignTable: "property_images",
              ascending: true,
            });
          }
          if (!isAdmin) {
            query = query.eq("owner_id", ownerId);
          }
          return query;
        };

        let { data, error } = await buildQuery(true);
        if (error && missingPosition(error.message)) {
          const fallback = await buildQuery(false);
          data = fallback.data;
          error = fallback.error;
        }
        if (error) {
          fetchError = error.message;
        } else {
          const typed =
            (data as Array<Property & { property_images?: Array<{ id: string; image_url: string }> }>) ||
            [];
            properties =
            typed.map((row) => ({
              ...row,
              images: orderImagesWithCover(
                row.cover_image_url,
                row.property_images?.map((img) => ({
                  id: img.id || img.image_url,
                  image_url: img.image_url,
                  position: (img as { position?: number }).position,
                  created_at: (img as { created_at?: string | null }).created_at ?? undefined,
                }))
              ),
            })) || [];
        }

        if (role === "landlord" || role === "agent") {
          const planClient = hasServiceRoleEnv()
            ? createServiceRoleClient()
            : ownerId === user.id
              ? supabase
              : null;
          if (planClient) {
            const { data: planRow } = await planClient
              .from("profile_plans")
              .select(
                "plan_tier, max_listings_override, valid_until"
              )
              .eq("profile_id", ownerId)
              .maybeSingle();
            planTier = planRow?.plan_tier ?? null;
            maxOverride = planRow?.max_listings_override ?? null;
            validUntil = planRow?.valid_until ?? null;
          }

          const { data: upgradeRequest } = await supabase
            .from("plan_upgrade_requests")
            .select("id")
            .eq("profile_id", ownerId)
            .eq("status", "pending")
            .maybeSingle();
          pendingUpgrade = !!upgradeRequest;
        }
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Unknown error while fetching properties";
    }
  } else {
    fetchError = "Supabase env vars missing; add NEXT_PUBLIC_SITE_URL and Supabase keys.";
  }

  const expired =
    !!validUntil && Number.isFinite(Date.parse(validUntil)) && Date.parse(validUntil) < Date.now();
  const plan =
    role === "landlord" || role === "agent"
      ? getPlanForTier(expired ? "free" : planTier ?? "free", expired ? null : maxOverride)
      : null;
  const activeCount = properties.filter((property) => {
    if (property.status) {
      return property.status === "pending" || property.status === "live";
    }
    return !!property.is_active;
  }).length;
  const listingLimitReached = isListingLimitReached(activeCount, plan);
  const showErrorDetails = process.env.NODE_ENV === "development";
  const normalizedFetchError = fetchError?.toLowerCase() ?? "";
  const needsLogin =
    normalizedFetchError.includes("unauthorized") ||
    normalizedFetchError.includes("not authenticated");
  const dashboardError = fetchError
    ? normalizedFetchError.includes("supabase env vars missing")
      ? "Dashboard data is unavailable right now. Please contact support."
      : needsLogin
        ? "Your session has expired. Please log in again."
        : "We couldn't load your listings right now. Please try again."
    : null;
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
          {listingLimitReached ? (
            <Button variant="secondary" disabled>
              Max listings reached
            </Button>
          ) : (
            <Link href="/dashboard/properties/new">
              <Button>New listing</Button>
            </Link>
          )}
        </div>
      </div>

      {plan && listingLimitReached && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            You have reached your {plan.name} plan limit ({activeCount}/{plan.maxListings}).
          </p>
          <p className="mt-1">
            Upgrade to publish more listings and unlock premium distribution.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/billing#plans">
              <Button size="sm">View plans</Button>
            </Link>
            {pendingUpgrade ? (
              <Button variant="secondary" size="sm" disabled>
                Request sent
              </Button>
            ) : (
              <form action={requestUpgrade}>
                <Button variant="secondary" size="sm" type="submit">
                  Request upgrade
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
      {plan && expired && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Your paid plan has expired.</p>
          <p className="mt-1">
            You are now on the Free plan. Renew to restore higher listing limits.
          </p>
          <div className="mt-3">
            <Link href="/dashboard/billing#plans">
              <Button size="sm">View plans</Button>
            </Link>
          </div>
        </div>
      )}

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
      {(role === "landlord" || role === "agent") && trustMarkers && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Trust status</h3>
          <p className="mt-1 text-sm text-slate-600">
            Verification markers help tenants feel confident about your listing.
          </p>
          <div className="mt-3 space-y-2">
            <TrustBadges markers={trustMarkers} />
            <TrustReliability markers={trustMarkers} />
            {trustMarkers.trust_updated_at && (
              <p className="text-xs text-slate-500">
                Last updated {new Date(trustMarkers.trust_updated_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="space-y-3">
        {dashboardError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>{dashboardError}</p>
            {needsLogin && (
              <Link
                href="/auth/login?reason=auth&next=/host"
                className="mt-2 inline-flex text-sm font-semibold text-amber-900 underline-offset-4 hover:underline"
              >
                Log in again
              </Link>
            )}
            {fetchError && showErrorDetails && (
              <p className="mt-2 text-xs text-amber-900">
                Details: {fetchError}
              </p>
            )}
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
                      trustMarkers={trustMarkers}
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
                      listingLimitReached ? (
                        <Button size="sm" type="button" variant="secondary" disabled>
                          Submit for approval
                        </Button>
                      ) : (
                        <form action={submitForApproval.bind(null, property.id)}>
                          <Button size="sm" type="submit">
                            Submit for approval
                          </Button>
                        </form>
                      )
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
              <Button size="sm" disabled={listingLimitReached}>
                Create listing
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
