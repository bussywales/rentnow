"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PublicShortletStayReview } from "@/lib/shortlet/reviews";

type Props = {
  bookingId: string;
  initialReview: PublicShortletStayReview | null;
  canLeaveReview: boolean;
};

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function TripReviewCard({ bookingId, initialReview, canLeaveReview }: Props) {
  const [review, setReview] = useState<PublicShortletStayReview | null>(initialReview);
  const [rating, setRating] = useState<number>(initialReview?.rating ?? 5);
  const [body, setBody] = useState(initialReview?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyLength = body.trim().length;

  const disabled = useMemo(() => saving || bodyLength < 20, [bodyLength, saving]);

  async function submitReview() {
    if (disabled) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/shortlet/bookings/${bookingId}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { review?: PublicShortletStayReview; error?: string }
        | null;
      if (!response.ok || !payload?.review) {
        throw new Error(payload?.error || "Unable to publish review");
      }
      setReview(payload.review);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to publish review");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="trip-review-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Completed stay review</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">How was your host?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Reviews are published only after a completed stay and help future guests trust real hosts.
          </p>
        </div>
        {review ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            {review.rating}/5 published
          </span>
        ) : null}
      </div>

      {review ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Your review</p>
            <p className="text-xs text-slate-500">Published {formatReviewDate(review.createdAt)}</p>
          </div>
          <p className="mt-2 text-sm text-slate-700">{review.body}</p>
          {review.publicResponse ? (
            <div className="mt-3 rounded-lg border border-sky-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Host response</p>
              <p className="mt-1 text-sm text-slate-700">{review.publicResponse}</p>
            </div>
          ) : null}
        </div>
      ) : canLeaveReview ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Rating</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    rating === value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="trip-review-body">
              Short review
            </label>
            <textarea
              id="trip-review-body"
              value={body}
              onChange={(event) => setBody(event.currentTarget.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-500"
              placeholder="Share what future guests should know about the stay, communication, and follow-through."
            />
            <p className="mt-1 text-xs text-slate-500">{bodyLength}/600 characters</p>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={() => void submitReview()} disabled={disabled}>
              {saving ? "Publishing..." : "Publish review"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
          Reviews unlock after a completed stay and are limited to real guests.
        </div>
      )}
    </section>
  );
}
