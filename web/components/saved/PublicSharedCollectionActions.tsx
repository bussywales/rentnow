"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { buildCollectionWhatsAppShareUrl } from "@/lib/saved-collections/share";

type ActionType = "save_shortlist" | "follow_search";

type Props = {
  shareId: string;
  collectionTitle: string;
  shareUrl: string;
  showStickyMobile?: boolean;
};

type ActionNotice = {
  message: string;
  href?: string;
  hrefLabel?: string;
};

function buildActionRedirectPath(input: { shareId: string; action: ActionType }) {
  return `/collections/${encodeURIComponent(input.shareId)}?action=${input.action}`;
}

function readActionParam(): ActionType | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get("action");
  if (value === "save_shortlist" || value === "follow_search") {
    return value;
  }
  return null;
}

export function PublicSharedCollectionActions({
  shareId,
  collectionTitle,
  shareUrl,
  showStickyMobile = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [busyAction, setBusyAction] = useState<ActionType | null>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoRun, setHasAutoRun] = useState(false);
  const autoRunKeyRef = useRef<string | null>(null);

  const resolvedShareUrl = useMemo(() => {
    if (shareUrl) return shareUrl;
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, [shareUrl]);

  const clearActionParam = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("action")) return;
    params.delete("action");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router]);

  const redirectToAuthRequired = useCallback(
    (action: ActionType) => {
      const redirectPath = buildActionRedirectPath({ shareId, action });
      const url = `/auth/required?redirect=${encodeURIComponent(redirectPath)}&reason=auth`;
      window.location.href = url;
    },
    [shareId]
  );

  const runAction = useCallback(
    async (action: ActionType, opts?: { auto?: boolean }) => {
      setBusyAction(action);
      setError(null);
      setNotice(null);

      try {
        const endpoint =
          action === "save_shortlist"
            ? "/api/saved/collections/import"
            : "/api/saved-searches/from-collection";

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareId }),
        });

        if (response.status === 401) {
          redirectToAuthRequired(action);
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to complete action.");
        }

        if (action === "save_shortlist") {
          const collectionId = typeof payload?.collectionId === "string" ? payload.collectionId : "";
          setNotice({
            message: "Shortlist saved to your Collections.",
            href: collectionId ? `/saved/${encodeURIComponent(collectionId)}` : undefined,
            hrefLabel: collectionId ? "Open collection" : undefined,
          });
        } else {
          setNotice({
            message: "Search followed. You’ll get alerts for new matches.",
            href: typeof payload?.manageHref === "string" ? payload.manageHref : "/saved-searches",
            hrefLabel: "Manage saved searches",
          });
        }
      } catch (actionError) {
        const message = actionError instanceof Error ? actionError.message : "Unable to complete action.";
        setError(message);
      } finally {
        setBusyAction(null);
        if (opts?.auto) {
          clearActionParam();
        }
      }
    },
    [clearActionParam, redirectToAuthRequired, shareId]
  );

  useEffect(() => {
    const action = readActionParam();
    if (!action) {
      setHasAutoRun(false);
      return;
    }

    const key = `${shareId}:${action}`;
    if (autoRunKeyRef.current === key || hasAutoRun) return;
    autoRunKeyRef.current = key;
    setHasAutoRun(true);
    void runAction(action, { auto: true });
  }, [hasAutoRun, runAction, shareId]);

  const handleCopyLink = useCallback(async () => {
    if (!resolvedShareUrl) return;
    try {
      await navigator.clipboard.writeText(resolvedShareUrl);
      setError(null);
      setNotice({ message: "Share link copied." });
    } catch {
      setError("Unable to copy share link.");
    }
  }, [resolvedShareUrl]);

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Button
            size="sm"
            onClick={() => {
              void runAction("save_shortlist");
            }}
            disabled={busyAction !== null}
          >
            {busyAction === "save_shortlist" ? "Saving..." : "Save this shortlist"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void runAction("follow_search");
            }}
            disabled={busyAction !== null}
          >
            {busyAction === "follow_search" ? "Following..." : "Follow this search"}
          </Button>
          <Link
            href={buildCollectionWhatsAppShareUrl({
              shareUrl: resolvedShareUrl,
              collectionTitle,
            })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex"
          >
            <Button size="sm" variant="secondary" type="button">
              Share to WhatsApp
            </Button>
          </Link>
          <Button type="button" size="sm" variant="ghost" onClick={handleCopyLink}>
            Copy link
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:hidden">
          <Link
            href={buildCollectionWhatsAppShareUrl({
              shareUrl: resolvedShareUrl,
              collectionTitle,
            })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex"
          >
            <Button size="sm" variant="secondary" type="button">
              Share to WhatsApp
            </Button>
          </Link>
          <Button type="button" size="sm" variant="ghost" onClick={handleCopyLink}>
            Copy link
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          PropatyHub is a marketplace. Always verify viewing details before paying.
        </p>
        {notice ? (
          <p className="mt-2 text-xs text-emerald-700" aria-live="polite">
            {notice.message}{" "}
            {notice.href && notice.hrefLabel ? (
              <Link href={notice.href} className="font-semibold text-emerald-800 underline">
                {notice.hrefLabel}
              </Link>
            ) : null}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-rose-600" aria-live="polite">
            {error}
          </p>
        ) : null}
      </section>
      {showStickyMobile ? (
        <div className="sm:hidden">
          <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void runAction("save_shortlist");
                }}
                disabled={busyAction !== null}
              >
                {busyAction === "save_shortlist" ? "Saving..." : "Save shortlist"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void runAction("follow_search");
                }}
                disabled={busyAction !== null}
              >
                {busyAction === "follow_search" ? "Following..." : "Follow search"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
