import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import { buildSelectedUrl } from "@/lib/admin/admin-review";
import { getReviewListingById, loadReviewListings } from "@/lib/admin/admin-review-loader";
import AdminReviewMobileDetailPanel from "@/components/admin/AdminReviewMobileDetailPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Props = {
  params: Promise<{ listingId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
};

function buildBackHref(searchParams?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key === "id") return;
      if (Array.isArray(value)) {
        value.forEach((v) => v && params.append(key, v));
        return;
      }
      if (value) params.set(key, value);
    });
  }
  const qs = params.toString();
  return qs ? `/admin/review?${qs}` : "/admin/review";
}

export default async function AdminReviewDetailPage({ params, searchParams }: Props) {
  const { listingId } = await params;
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

  const { listing: directListing } = await getReviewListingById(
    supabase,
    profile?.role ?? null,
    listingId
  );
  let listing = directListing;
  if (!listing) {
    const { listings } = await loadReviewListings(supabase, profile?.role ?? null);
    listing = listings.find((item) => item.id === listingId) ?? null;
  }
  const backHref = buildBackHref(searchParams);

  if (!listing) {
    return (
      <div className="space-y-4 p-4 sm:p-6" data-testid="admin-review-mobile-detail">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Review listing</h1>
            <p className="text-sm text-slate-600">{ADMIN_REVIEW_COPY.headerSubtitle}</p>
          </div>
          <Link href={backHref} className="text-sm text-sky-600 hover:text-sky-700">
            Back to queue
          </Link>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Listing not found.
        </div>
      </div>
    );
  }

  const canonicalUrl = buildSelectedUrl("/admin/review", listing.id);

  return (
    <div className="space-y-4 p-4 sm:p-6" data-testid="admin-review-mobile-detail">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{ADMIN_REVIEW_COPY.headerTitle}</h1>
          <p className="text-sm text-slate-600">{ADMIN_REVIEW_COPY.headerSubtitle}</p>
        </div>
        <Link href={backHref} className="text-sm text-sky-600 hover:text-sky-700">
          Back to queue
        </Link>
      </div>
      {listing.reviewStage === null && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Not currently in the review queue.
        </div>
      )}
      <AdminReviewMobileDetailPanel listing={listing} backHref={backHref} />
      <link rel="canonical" href={canonicalUrl} />
    </div>
  );
}
