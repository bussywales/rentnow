"use client";

import Link from "next/link";
import { useState } from "react";
import type { Property } from "@/lib/types";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import type { ListingSocialProof } from "@/lib/properties/listing-trust-badges";
import type { TrustMarkerState } from "@/lib/trust-markers";

type CollectionDetail = {
  id: string;
  title: string;
  count: number;
  shareUrl: string | null;
  isDefault: boolean;
};

type Props = {
  collection: CollectionDetail;
  initialProperties: Property[];
  trustSnapshotsByOwner: Record<string, TrustMarkerState>;
  socialProofByListing: Record<string, ListingSocialProof>;
};

function buildWhatsappShareUrl(shareUrl: string) {
  return `https://wa.me/?text=${encodeURIComponent(`Here are some properties on PropatyHub: ${shareUrl}`)}`;
}

export function SavedCollectionDetailClient({
  collection,
  initialProperties,
  trustSnapshotsByOwner,
  socialProofByListing,
}: Props) {
  const [properties, setProperties] = useState(initialProperties);
  const [shareUrl, setShareUrl] = useState(collection.shareUrl);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const removeListing = async (listingId: string) => {
    setBusyId(listingId);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/saved/collections/${encodeURIComponent(collection.id)}/items/${encodeURIComponent(listingId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to remove listing.");
      }
      setProperties((prev) => prev.filter((property) => property.id !== listingId));
      setNotice("Removed from collection.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove listing.");
    } finally {
      setBusyId(null);
    }
  };

  const ensureShareEnabled = async () => {
    if (shareUrl) return;
    setBusyId(collection.id);
    setError(null);
    try {
      const response = await fetch(`/api/saved/collections/${encodeURIComponent(collection.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareEnabled: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to enable sharing.");
      }
      const payload = await response.json().catch(() => ({}));
      setShareUrl((payload?.collection?.shareUrl as string | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to enable sharing.");
    } finally {
      setBusyId(null);
    }
  };

  const openShare = async () => {
    await ensureShareEnabled();
    setShareOpen(true);
  };

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Share link copied.");
    } catch {
      setError("Unable to copy share link.");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Collection</p>
            <h1 className="text-2xl font-semibold text-slate-900">{collection.title}</h1>
            <p className="text-sm text-slate-600">
              {properties.length} saved {properties.length === 1 ? "listing" : "listings"}
              {collection.isDefault ? " · Default favourites" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/favourites">
              <Button variant="secondary" size="sm">
                Back to collections
              </Button>
            </Link>
            <Button size="sm" onClick={openShare} disabled={busyId === collection.id}>
              Share
            </Button>
          </div>
        </div>
        {notice ? <p className="mt-2 text-xs text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      </section>

      {properties.length ? (
        <section className="grid gap-4 md:grid-cols-2">
          {properties.map((property) => (
            <article key={property.id} className="space-y-2">
              <PropertyCard
                property={property}
                href={`/properties/${property.id}`}
                trustMarkers={trustSnapshotsByOwner[property.owner_id]}
                socialProof={socialProofByListing[property.id] ?? null}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => removeListing(property.id)}
                disabled={busyId === property.id}
              >
                {busyId === property.id ? "Removing..." : "Remove from collection"}
              </Button>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-slate-900">This collection is empty</h2>
          <p className="mt-1 text-sm text-slate-600">
            Save homes from browse results, then organize them here.
          </p>
          <Link href="/properties" className="mt-4 inline-flex">
            <Button>Browse listings</Button>
          </Link>
        </section>
      )}

      {shareOpen ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/45 px-4"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.currentTarget === event.target) setShareOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Share this collection</h3>
                <p className="text-xs text-slate-500">Read-only public link</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShareOpen(false)}>
                Close
              </Button>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 break-all">
              {shareUrl || "No share link yet."}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={copyShare} disabled={!shareUrl}>
                Copy link
              </Button>
              {shareUrl ? (
                <Link href={buildWhatsappShareUrl(shareUrl)} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm">
                    WhatsApp
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
