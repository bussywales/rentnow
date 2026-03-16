"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatLocationLabel, formatPriceValue } from "@/lib/property-discovery";
import type { PropertyRequestResponseListing } from "@/lib/requests/property-requests";

type Props = {
  requestId: string;
  listings: PropertyRequestResponseListing[];
  alreadySentListingIds?: string[];
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80";

export function PropertyRequestResponseComposer({
  requestId,
  listings,
  alreadySentListingIds = [],
}: Props) {
  const router = useRouter();
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadySent = useMemo(() => new Set(alreadySentListingIds), [alreadySentListingIds]);
  const selectableListings = useMemo(
    () => listings.filter((listing) => !alreadySent.has(listing.id)),
    [alreadySent, listings]
  );

  function toggleListing(listingId: string) {
    setSelectedListingIds((current) => {
      if (current.includes(listingId)) {
        return current.filter((id) => id !== listingId);
      }
      if (current.length >= 3) {
        return current;
      }
      return [...current, listingId];
    });
  }

  async function submit() {
    if (selectedListingIds.length === 0) {
      setError("Select at least one listing to send.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${requestId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          listingIds: selectedListingIds,
          message: message.trim() ? message.trim() : null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; duplicateListingIds?: string[]; missingListingIds?: string[] }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send matching listings.");
      }

      setSelectedListingIds([]);
      setMessage("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send matching listings.");
    } finally {
      setPending(false);
    }
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        You do not have any eligible live listings that match this request yet.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="property-request-response-composer">
      {selectableListings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          You have already sent all eligible listings you manage for this request.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Select up to 3 live listings you own or manage. Contact details stay hidden; the seeker will
            only see the listings and your optional note.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {listings.map((listing) => {
              const selected = selectedListingIds.includes(listing.id);
              const sent = alreadySent.has(listing.id);
              return (
                <label
                  key={listing.id}
                  className={`flex gap-3 rounded-2xl border p-3 transition ${
                    selected
                      ? "border-sky-500 bg-sky-50"
                      : sent
                        ? "border-slate-200 bg-slate-50 opacity-75"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
                    checked={selected}
                    disabled={pending || sent}
                    onChange={() => toggleListing(listing.id)}
                  />
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <SafeImage
                        src={listing.coverImageUrl || FALLBACK_IMAGE}
                        alt={listing.title}
                        fill
                        sizes="96px"
                        className="object-cover"
                        usage="noncritical"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{listing.title}</p>
                        {sent ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                            Sent
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatLocationLabel(listing.city, listing.neighbourhood)}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {formatPriceValue(listing.currency, listing.price)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {typeof listing.bedrooms === "number" ? `${listing.bedrooms} bed` : "Bedrooms flexible"}
                        {typeof listing.bathrooms === "number" ? ` • ${listing.bathrooms} bath` : ""}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Optional note</span>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Briefly explain why these listings fit. Contact details are not allowed here."
              maxLength={500}
              rows={4}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3" data-testid="property-request-response-actions">
            <Button type="button" onClick={() => void submit()} disabled={pending || selectedListingIds.length === 0}>
              {pending ? "Sending..." : "Send matching listings"}
            </Button>
            <p className="text-xs text-slate-500">{selectedListingIds.length}/3 selected</p>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
