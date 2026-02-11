"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";

type Props = {
  propertyId: string;
  initialSaved?: boolean;
  variant?: "button" | "icon";
  className?: string;
};

type CollectionSummary = {
  id: string;
  title: string;
  count: number;
  isDefault: boolean;
  containsListing: boolean;
};

type CollectionApiRow = {
  id?: unknown;
  title?: unknown;
  count?: unknown;
  isDefault?: unknown;
  containsListing?: unknown;
};

const SAVE_INTENT_KEY = "ph:save-intent";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden
      className={cn("h-4 w-4", filled ? "fill-current" : "fill-none")}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M20.5 12.2c-.9 2.8-4.7 6-8.5 8.8-3.8-2.8-7.6-6-8.5-8.8-1-3.1.6-6.2 3.8-6.9 1.9-.4 3.8.2 4.7 1.6.9-1.4 2.8-2 4.7-1.6 3.2.7 4.8 3.8 3.8 6.9z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SaveButton({
  propertyId,
  initialSaved = false,
  variant = "button",
  className,
}: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [collectionPendingId, setCollectionPendingId] = useState<string | null>(null);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const supabaseEnabled =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDemoSave = propertyId.startsWith("mock-") || !supabaseEnabled;

  const currentPath = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const loginHref = `/auth/login?reason=auth&redirect=${encodeURIComponent(currentPath)}`;

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  useEffect(() => {
    if (isDemoSave || saved) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SAVE_INTENT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { propertyId?: string };
      if (parsed?.propertyId !== propertyId) return;
      window.localStorage.removeItem(SAVE_INTENT_KEY);
      handleToggle(true);
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoSave, propertyId, saved]);

  const handleToggle = (forced?: boolean) => {
    const nextSaved = typeof forced === "boolean" ? forced : !saved;
    if (saved && nextSaved) return;
    const previousSaved = saved;
    startTransition(async () => {
      setError(null);
      setNotice(null);

      if (isDemoSave) {
        setSaved(nextSaved);
        setNotice("Saved in demo mode. Connect Supabase and log in to sync.");
        return;
      }

      const trimmedId = propertyId.trim();
      if (!trimmedId) {
        setSaved(previousSaved);
        setError("Unable to save: missing property id. Please refresh and try again.");
        return;
      }

      try {
        setSaved(nextSaved);
        const res = await fetch("/api/saved/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: trimmedId, desiredSaved: nextSaved }),
        });
        if (!res.ok) {
          if (res.status === 401) {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(
                SAVE_INTENT_KEY,
                JSON.stringify({ propertyId: trimmedId, at: Date.now() })
              );
            }
            router.push(loginHref);
            setSaved(previousSaved);
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Unable to update saved state");
        }
        const payload = await res.json().catch(() => ({}));
        if (typeof payload?.saved === "boolean") {
          setSaved(payload.saved);
        }
      } catch (err) {
        setSaved(previousSaved);
        const message = err instanceof Error ? err.message : "Unable to update saved state";
        setError(message);
      }
    });
  };

  const loadCollections = async () => {
    if (isDemoSave) {
      setCollectionsError("Collections are unavailable in demo mode.");
      return false;
    }
    setCollectionsLoading(true);
    setCollectionsError(null);
    try {
      const res = await fetch(`/api/saved/collections?listingId=${encodeURIComponent(propertyId)}`);
      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              SAVE_INTENT_KEY,
              JSON.stringify({ propertyId: propertyId.trim(), at: Date.now() })
            );
          }
          router.push(loginHref);
          return false;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Unable to load collections.");
      }
      const payload = await res.json().catch(() => ({}));
      const rows: CollectionApiRow[] = Array.isArray(payload?.collections)
        ? (payload.collections as CollectionApiRow[])
        : [];
      setCollections(
        rows.map((row) => ({
          id: String(row.id || ""),
          title: String(row.title || ""),
          count: Number(row.count || 0),
          isDefault: Boolean(row.isDefault),
          containsListing: Boolean(row.containsListing),
        }))
      );
      const defaultRow = rows.find((row) => Boolean(row?.isDefault));
      if (defaultRow && typeof defaultRow.containsListing === "boolean") {
        setSaved(Boolean(defaultRow.containsListing));
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load collections.";
      setCollectionsError(message);
      return false;
    } finally {
      setCollectionsLoading(false);
    }
  };

  const openCollections = async () => {
    const loaded = await loadCollections();
    if (loaded) {
      setCollectionsOpen(true);
      setCollectionsError(null);
    }
  };

  const updateCollectionMembership = async (collection: CollectionSummary) => {
    if (!collection.id) return;
    setCollectionPendingId(collection.id);
    setCollectionsError(null);
    try {
      const method = collection.containsListing ? "DELETE" : "POST";
      const endpoint = collection.containsListing
        ? `/api/saved/collections/${encodeURIComponent(collection.id)}/items/${encodeURIComponent(propertyId)}`
        : `/api/saved/collections/${encodeURIComponent(collection.id)}/items`;
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ listingId: propertyId }) : undefined,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to update collection.");
      }

      setCollections((prev) =>
        prev.map((item) => {
          if (item.id !== collection.id) return item;
          const nextContains = !collection.containsListing;
          return {
            ...item,
            containsListing: nextContains,
            count: Math.max(0, item.count + (nextContains ? 1 : -1)),
          };
        })
      );

      if (collection.isDefault) {
        setSaved(!collection.containsListing);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update collection.";
      setCollectionsError(message);
    } finally {
      setCollectionPendingId(null);
    }
  };

  const createCollection = async () => {
    const title = newCollectionTitle.trim();
    if (!title) {
      setCollectionsError("Enter a collection name.");
      return;
    }
    setCreatingCollection(true);
    setCollectionsError(null);
    try {
      const createRes = await fetch("/api/saved/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!createRes.ok) {
        const payload = await createRes.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to create collection.");
      }
      const createPayload = await createRes.json().catch(() => ({}));
      const collectionId = String(createPayload?.collection?.id || "");
      if (collectionId) {
        const addRes = await fetch(`/api/saved/collections/${encodeURIComponent(collectionId)}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: propertyId }),
        });
        if (!addRes.ok) {
          const payload = await addRes.json().catch(() => ({}));
          throw new Error(payload?.error || "Unable to save listing in new collection.");
        }
      }
      setNewCollectionTitle("");
      await loadCollections();
      setNotice(`Saved to ${title}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create collection.";
      setCollectionsError(message);
    } finally {
      setCreatingCollection(false);
    }
  };

  const accessibleLabel = saved ? "Saved listing" : "Save listing";
  const statusText = loading ? "Saving..." : saved ? "Saved" : "Save property";
  const showFeedback = variant !== "icon";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {variant === "icon" ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleToggle()}
            disabled={loading}
            aria-pressed={saved}
            aria-label={accessibleLabel}
            title={`${accessibleLabel} (quick save to Favourites)`}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition",
              saved
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-white/80 bg-white/90 text-slate-600 hover:text-slate-900"
            )}
            data-testid="save-toggle"
          >
            <HeartIcon filled={saved} />
            <span className="sr-only">{accessibleLabel}</span>
          </button>
          <button
            type="button"
            onClick={openCollections}
            disabled={loading}
            aria-label="Save to collection"
            title="Save to..."
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-600 shadow-sm transition hover:text-slate-900"
            data-testid="save-to-collections-open"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleToggle()}
            disabled={loading}
            aria-pressed={saved}
            data-testid="save-button"
          >
            {statusText}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openCollections}
            disabled={loading}
            data-testid="save-to-collections-open"
          >
            Save to...
          </Button>
        </div>
      )}
      {showFeedback && notice && !error && (
        <p className="text-xs text-slate-600" aria-live="polite">
          {notice}
        </p>
      )}
      {showFeedback && error && (
        <p className="text-xs text-rose-600" aria-live="polite">
          {error}
        </p>
      )}
      {!showFeedback && (notice || error) && (
        <span className="sr-only" aria-live="polite">
          {error || notice}
        </span>
      )}
      {collectionsOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/45 px-4"
          role="dialog"
          aria-modal="true"
          data-testid="save-collections-modal"
          onClick={(event) => {
            if (event.currentTarget === event.target) setCollectionsOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Save to collection</h3>
                <p className="text-xs text-slate-500">
                  Quick save uses Favourites. Use collections to organize homes.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setCollectionsOpen(false)}>
                Close
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {collectionsLoading ? (
                <p className="text-sm text-slate-600">Loading collections...</p>
              ) : collections.length ? (
                collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {collection.title}
                        {collection.isDefault ? (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            Default
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">{collection.count} saved</p>
                    </div>
                    <Button
                      variant={collection.containsListing ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => updateCollectionMembership(collection)}
                      disabled={collectionPendingId === collection.id}
                    >
                      {collectionPendingId === collection.id
                        ? "Saving..."
                        : collection.containsListing
                          ? "Remove"
                          : "Save"}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No collections yet.</p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">Create new collection</p>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={newCollectionTitle}
                  onChange={(event) => setNewCollectionTitle(event.target.value)}
                  placeholder="Collection name"
                  maxLength={80}
                />
                <Button size="sm" onClick={createCollection} disabled={creatingCollection}>
                  {creatingCollection ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>

            {collectionsError ? (
              <p className="mt-3 text-xs text-rose-600" aria-live="polite">
                {collectionsError}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
