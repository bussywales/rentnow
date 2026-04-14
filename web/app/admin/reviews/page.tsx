import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { listAdminCompletedStayReviews } from "@/lib/shortlet/reviews.server";
import { normalizeRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
}

function resolveFromDate(range: string) {
  if (range === "all") return null;
  const now = new Date();
  const days = range === "90d" ? 90 : 30;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString();
}

function ratingTone(rating: number) {
  if (rating <= 2) return "border-rose-200 bg-rose-50 text-rose-700";
  if (rating === 3) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  if (!hasServerSupabaseEnv()) redirect("/forbidden");

  const params = await searchParams;
  const range = readSingleParam(params, "range") || "30d";
  const responded = readSingleParam(params, "responded") || "all";
  const rating = readSingleParam(params, "rating") || "all";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/required?redirect=/admin/reviews&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (normalizeRole(profile?.role) !== "admin") redirect("/forbidden?reason=role");

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const result = await listAdminCompletedStayReviews({
    client,
    limit: 120,
    response:
      responded === "responded" || responded === "pending_response" ? responded : "all",
    rating: rating === "low" ? "low" : "all",
    from: resolveFromDate(range),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4" data-testid="admin-reviews-page">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Stay reviews</p>
        <p className="text-sm text-slate-200">
          Recent completed-stay reviews, low-rating watch, and host response coverage.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
          <Link href="/admin/shortlets" className="underline underline-offset-4">
            Shortlet bookings
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="admin-reviews-summary">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reviews</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{result.summary.totalReviews}</p>
          <p className="text-xs text-slate-500">In the current review window</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Average rating</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {result.summary.averageRating !== null ? `${result.summary.averageRating.toFixed(1)}/5` : "—"}
          </p>
          <p className="text-xs text-slate-500">Published completed-stay reviews only</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Low ratings</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{result.summary.lowRatingCount}</p>
          <p className="text-xs text-slate-500">Ratings at 3/5 or below</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Awaiting response</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{result.summary.awaitingResponseCount}</p>
          <p className="text-xs text-slate-500">Hosts without a public response yet</p>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-sm"
        data-testid="admin-reviews-filters"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Range
          </span>
          <select
            name="range"
            defaultValue={range}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Response
          </span>
          <select
            name="responded"
            defaultValue={responded}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="all">All</option>
            <option value="pending_response">Awaiting response</option>
            <option value="responded">Responded</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Rating
          </span>
          <select
            name="rating"
            defaultValue={rating}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="all">All ratings</option>
            <option value="low">3/5 and below</option>
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white"
        >
          Apply
        </button>
      </form>

      {result.error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {result.error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="admin-reviews-table">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Stay context</th>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Response</th>
              <th className="px-4 py-3">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100" data-testid="admin-reviews-rows">
            {result.reviews.length ? (
              result.reviews.map((review) => (
                <tr key={review.id} data-testid="admin-review-row">
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${ratingTone(review.rating)}`}>
                      {review.rating}/5
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-3 align-top">
                    <div className="font-semibold text-slate-900">{review.propertyTitle || "Completed stay"}</div>
                    <p className="mt-1 text-sm text-slate-700">{review.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(review.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-600">
                    <div>Booking: {review.bookingId}</div>
                    <div>
                      Stay: {review.checkIn || "—"} to {review.checkOut || "—"}
                    </div>
                    <div>{review.propertyCity || "Unknown city"}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-600">
                    <div className="font-semibold text-slate-900">{review.guestName || review.reviewerUserId}</div>
                    <div>{review.reviewerRole}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-600">
                    <div className="font-semibold text-slate-900">{review.hostName || review.revieweeUserId}</div>
                    <div>{review.revieweeRole}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-600">
                    {review.publicResponse ? (
                      <>
                        <div className="font-semibold text-emerald-700">Responded</div>
                        <p className="mt-1 max-w-xs text-slate-700">{review.publicResponse}</p>
                        <div className="mt-1 text-slate-500">
                          {formatDate(review.publicResponseUpdatedAt)}
                        </div>
                      </>
                    ) : (
                      <div className="font-semibold text-amber-700">Awaiting host response</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs">
                    <div className="flex flex-col gap-2">
                      <Link href={review.bookingContextHref} className="font-semibold text-sky-700 hover:text-sky-800">
                        Booking context
                      </Link>
                      <Link href={review.propertyHref} className="font-semibold text-sky-700 hover:text-sky-800">
                        Property
                      </Link>
                      <Link href={review.publicProfileHref} className="font-semibold text-sky-700 hover:text-sky-800">
                        Public profile
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-slate-500">
                  No completed-stay reviews match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
