"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type SavedCollectionCard = {
  id: string;
  title: string;
  count: number;
  isDefault: boolean;
  shareId: string | null;
  shareUrl: string | null;
  coverImageUrl: string | null;
  coverTitle: string | null;
  updatedAt: string;
};

type SavedCollectionApiRow = {
  id?: unknown;
  title?: unknown;
  count?: unknown;
  isDefault?: unknown;
  shareId?: unknown;
  shareUrl?: unknown;
  coverImageUrl?: unknown;
  coverTitle?: unknown;
  updatedAt?: unknown;
};

type Props = {
  initialCollections: SavedCollectionCard[];
  savedSearchesHref: string;
};

function buildWhatsappShareUrl(shareUrl: string) {
  return `https://wa.me/?text=${encodeURIComponent(`Here are some properties on PropatyHub: ${shareUrl}`)}`;
}

export function SavedCollectionsClient({ initialCollections, savedSearchesHref }: Props) {
  const [collections, setCollections] = useState(initialCollections);
  const [newTitle, setNewTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareCollection, setShareCollection] = useState<SavedCollectionCard | null>(null);

  const hasAnySavedListing = useMemo(
    () => collections.some((collection) => collection.count > 0),
    [collections]
  );

  const refreshCollections = async () => {
    const response = await fetch("/api/saved/collections");
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || "Unable to load collections.");
    }
    const payload = await response.json().catch(() => ({}));
    const rows: SavedCollectionApiRow[] = Array.isArray(payload?.collections)
      ? (payload.collections as SavedCollectionApiRow[])
      : [];
    setCollections(
      rows.map((row) => ({
        id: String(row.id || ""),
        title: String(row.title || ""),
        count: Number(row.count || 0),
        isDefault: Boolean(row.isDefault),
        shareId: (row.shareId as string | null) ?? null,
        shareUrl: (row.shareUrl as string | null) ?? null,
        coverImageUrl: (row.coverImageUrl as string | null) ?? null,
        coverTitle: (row.coverTitle as string | null) ?? null,
        updatedAt: String(row.updatedAt || ""),
      }))
    );
  };

  const createCollection = async () => {
    const title = newTitle.trim();
    if (!title) {
      setError("Enter a collection name.");
      return;
    }
    setError(null);
    setNotice(null);
    setCreating(true);
    try {
      const response = await fetch("/api/saved/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to create collection.");
      }
      await refreshCollections();
      setNewTitle("");
      setNotice(`Created "${title}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create collection.");
    } finally {
      setCreating(false);
    }
  };

  const renameCollection = async (collection: SavedCollectionCard) => {
    const nextTitle = window.prompt("Rename collection", collection.title)?.trim();
    if (!nextTitle || nextTitle === collection.title) return;

    setBusyId(collection.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/saved/collections/${encodeURIComponent(collection.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to rename collection.");
      }
      await refreshCollections();
      setNotice("Collection renamed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename collection.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteCollection = async (collection: SavedCollectionCard) => {
    const confirmed = window.confirm(`Delete "${collection.title}"? This removes all saved items in it.`);
    if (!confirmed) return;

    setBusyId(collection.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/saved/collections/${encodeURIComponent(collection.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to delete collection.");
      }
      await refreshCollections();
      setNotice("Collection deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete collection.");
    } finally {
      setBusyId(null);
    }
  };

  const openShare = async (collection: SavedCollectionCard) => {
    setBusyId(collection.id);
    setError(null);
    setNotice(null);
    try {
      let next = collection;
      if (!collection.shareUrl) {
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
        const serverCollection = payload?.collection;
        next = {
          ...collection,
          shareId: (serverCollection?.shareId as string | null) ?? collection.shareId,
          shareUrl: (serverCollection?.shareUrl as string | null) ?? collection.shareUrl,
        };
        await refreshCollections();
      }
      setShareCollection(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open sharing.");
    } finally {
      setBusyId(null);
    }
  };

  const disableShare = async () => {
    if (!shareCollection) return;
    setBusyId(shareCollection.id);
    setError(null);
    try {
      const response = await fetch(`/api/saved/collections/${encodeURIComponent(shareCollection.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareEnabled: false }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to disable sharing.");
      }
      setShareCollection(null);
      await refreshCollections();
      setNotice("Sharing disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to disable sharing.");
    } finally {
      setBusyId(null);
    }
  };

  const copyShareLink = async () => {
    const shareUrl = shareCollection?.shareUrl || "";
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Share link copied.");
    } catch {
      setError("Unable to copy link.");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Saved collections</h1>
            <p className="text-sm text-slate-600">
              Organize favourites, share read-only collections, and send on WhatsApp.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Looking for saved searches?{" "}
              <Link href={savedSearchesHref} className="font-semibold text-sky-700">
                View saved searches →
              </Link>
            </p>
          </div>
          <Link href="/properties">
            <Button variant="secondary" size="sm">
              Browse properties
            </Button>
          </Link>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="New collection name"
            maxLength={80}
          />
          <Button onClick={createCollection} disabled={creating}>
            {creating ? "Creating..." : "New collection"}
          </Button>
        </div>
        {notice ? (
          <p className="mt-2 text-xs text-emerald-700" aria-live="polite">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-rose-600" aria-live="polite">
            {error}
          </p>
        ) : null}
      </section>

      {!hasAnySavedListing ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Start building your saved list</h2>
          <p className="mt-1 text-sm text-slate-600">
            We created a default <strong>Favourites</strong> collection for you. Tap the heart on any listing to save quickly.
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {collections.map((collection) => (
          <article
            key={collection.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div
              className="h-36 w-full bg-slate-100"
              style={
                collection.coverImageUrl
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.3)), url(${collection.coverImageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            />
            <div className="space-y-3 p-4">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {collection.title}
                  {collection.isDefault ? (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Default
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-600">
                  {collection.count} saved {collection.count === 1 ? "listing" : "listings"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/saved/${encodeURIComponent(collection.id)}`}>
                  <Button size="sm">Open</Button>
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openShare(collection)}
                  disabled={busyId === collection.id}
                >
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => renameCollection(collection)}
                  disabled={busyId === collection.id}
                >
                  Rename
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteCollection(collection)}
                  disabled={busyId === collection.id}
                >
                  Delete
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {shareCollection ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/45 px-4"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.currentTarget === event.target) setShareCollection(null);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Share collection</h3>
                <p className="text-xs text-slate-500">{shareCollection.title}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShareCollection(null)}>
                Close
              </Button>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 break-all">
              {shareCollection.shareUrl}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={copyShareLink}>
                Copy link
              </Button>
              {shareCollection.shareUrl ? (
                <Link
                  href={buildWhatsappShareUrl(shareCollection.shareUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="secondary" size="sm">
                    WhatsApp
                  </Button>
                </Link>
              ) : null}
              <Button variant="ghost" size="sm" onClick={disableShare} disabled={busyId === shareCollection.id}>
                Disable sharing
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
