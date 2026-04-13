import type { HostReviewSummary, PublicShortletStayReview } from "@/lib/shortlet/reviews";

function formatReviewDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

export function PublicHostReviewSummary(props: {
  summary: HostReviewSummary | null;
  reviews: PublicShortletStayReview[];
  title?: string;
  compact?: boolean;
}) {
  const summary = props.summary;
  if ((!summary || summary.reviewCount === 0) && props.reviews.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="public-host-review-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Completed-stay reviews</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{props.title ?? "Guest reputation"}</h3>
          <p className="mt-1 text-sm text-slate-600">
            Published after completed shortlet stays only.
          </p>
        </div>
        {summary && summary.averageRating !== null ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-right">
            <p className="text-2xl font-semibold text-slate-900">{summary.averageRating.toFixed(1)}/5</p>
            <p className="text-xs text-slate-600">
              {summary.reviewCount} review{summary.reviewCount === 1 ? "" : "s"}
              {summary.recommendRate !== null ? ` • ${summary.recommendRate}% recommend` : ""}
            </p>
          </div>
        ) : null}
      </div>

      {props.reviews.length ? (
        <div className={`mt-4 ${props.compact ? "space-y-2" : "space-y-3"}`}>
          {props.reviews.map((review) => (
            <article key={review.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{review.rating}/5</p>
                <p className="text-xs text-slate-500">
                  {[review.stayDateLabel, formatReviewDate(review.createdAt)].filter(Boolean).join(" • ")}
                </p>
              </div>
              <p className="mt-2 text-sm text-slate-700">{review.body}</p>
              {review.publicResponse ? (
                <div className="mt-3 rounded-lg border border-sky-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Host response</p>
                  <p className="mt-1 text-sm text-slate-700">{review.publicResponse}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
