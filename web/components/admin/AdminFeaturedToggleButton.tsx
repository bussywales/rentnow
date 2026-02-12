"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { isFeaturedListingActive } from "@/lib/properties/featured";

type Props = {
  propertyId: string;
  isFeatured: boolean;
  featuredUntil?: string | null;
  onUpdated?: (next: { is_featured: boolean; featured_until: string | null }) => void;
  onToast?: (message: string) => void;
  buttonClassName?: string;
  dataTestId?: string;
};

type DurationPreset = "7" | "30" | "none";

export default function AdminFeaturedToggleButton({
  propertyId,
  isFeatured,
  featuredUntil = null,
  onUpdated,
  onToast,
  buttonClassName,
  dataTestId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>("7");

  const featuredActive = useMemo(
    () => isFeaturedListingActive({ is_featured: isFeatured, featured_until: featuredUntil }),
    [isFeatured, featuredUntil]
  );
  const nextFeatured = !featuredActive;
  const title = nextFeatured ? "Mark listing as featured?" : "Remove featured status?";

  const handleConfirm = async () => {
    setPending(true);
    setError(null);
    try {
      const body: { featured: boolean; durationDays?: number | null } = {
        featured: nextFeatured,
      };
      if (nextFeatured) {
        body.durationDays = durationPreset === "none" ? null : Number(durationPreset);
      }
      const response = await fetch(`/api/admin/properties/${propertyId}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update featured status.");
      }
      onUpdated?.({
        is_featured: Boolean(payload?.is_featured),
        featured_until:
          typeof payload?.featured_until === "string" ? payload.featured_until : null,
      });
      onToast?.("Updated");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update featured status.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setError(null);
          setOpen(true);
        }}
        className={
          buttonClassName ||
          "rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
        }
        data-testid={dataTestId}
        title={nextFeatured ? "Mark as featured" : "Remove featured"}
      >
        <span className="hidden lg:inline">
          {nextFeatured ? "Mark as featured" : "Remove featured"}
        </span>
        <span className="lg:hidden">{nextFeatured ? "Feature" : "Unfeature"}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          data-testid="admin-featured-confirm-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-700">
              Featured listings get priority placement in featured rails when visible to the public.
            </p>
            <p className="mt-1 text-sm text-slate-700">
              If a listing is not approved/live/active, it will stay hidden until it becomes publicly
              visible.
            </p>

            {nextFeatured ? (
              <fieldset className="mt-3 space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Featured duration
                </legend>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      durationPreset === "7"
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    onClick={() => setDurationPreset("7")}
                    disabled={pending}
                    data-testid="admin-featured-duration-7"
                  >
                    7 days
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      durationPreset === "30"
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    onClick={() => setDurationPreset("30")}
                    disabled={pending}
                    data-testid="admin-featured-duration-30"
                  >
                    30 days
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      durationPreset === "none"
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    onClick={() => setDurationPreset("none")}
                    disabled={pending}
                    data-testid="admin-featured-duration-none"
                  >
                    No expiry
                  </button>
                </div>
              </fieldset>
            ) : null}

            {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
                data-testid="admin-featured-cancel"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={pending}
                data-testid="admin-featured-confirm"
              >
                {pending ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
