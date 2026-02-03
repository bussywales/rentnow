"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import {
  HELP_DRAWER_OPEN_EVENT,
  HELP_DRAWER_CLOSE_EVENT,
  UPDATES_DRAWER_OPEN_EVENT,
  UPDATES_DRAWER_CLOSE_EVENT,
  dispatchOverlayEvent,
} from "@/lib/ui/overlay-events";

export type ProductUpdateFeedItem = {
  id: string;
  title: string;
  summary: string;
  image_url?: string | null;
  published_at?: string | null;
  audience?: string | null;
  is_read: boolean;
};

type UpdatesSinceLastVisit = {
  since: string | null;
  count_new_since_last_visit: number;
  latest: Array<{
    id: string;
    title: string;
    published_at?: string | null;
    image_url?: string | null;
  }>;
};

type Props = {
  initialAuthed: boolean;
};

const SUMMARY_LIMIT = 240;

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMonthKey(value?: string | null) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(value?: string | null) {
  if (!value) return "Updates";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updates";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function truncateSummary(summary: string) {
  const trimmed = summary.trim();
  if (trimmed.length <= SUMMARY_LIMIT) return trimmed;
  return `${trimmed.slice(0, SUMMARY_LIMIT)}…`;
}

export function ProductUpdatesBell({ initialAuthed }: Props) {
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<ProductUpdateFeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinceLastVisit, setSinceLastVisit] = useState<UpdatesSinceLastVisit | null>(null);
  const [sinceLoading, setSinceLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>("");
  const seenSentRef = useRef(false);

  const hasUpdates = updates.length > 0;

  const unreadUpdates = useMemo(
    () => updates.filter((update) => !update.is_read).length,
    [updates]
  );

  const groupedUpdates = useMemo(() => {
    const sorted = [...updates].sort((a, b) => {
      const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
      return bTime - aTime;
    });

    const groups: Array<{
      key: string;
      label: string;
      items: ProductUpdateFeedItem[];
    }> = [];
    const index = new Map<string, number>();

    sorted.forEach((update) => {
      const key = getMonthKey(update.published_at);
      if (!index.has(key)) {
        index.set(key, groups.length);
        groups.push({
          key,
          label: formatMonthLabel(update.published_at),
          items: [],
        });
      }
      const groupIndex = index.get(key);
      if (groupIndex !== undefined) {
        groups[groupIndex].items.push(update);
      }
    });

    return groups;
  }, [updates]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    setLightboxUrl(null);
  }, []);

  const openDrawer = useCallback(() => {
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        previousActiveRef.current = active;
      }
    }
    dispatchOverlayEvent(HELP_DRAWER_CLOSE_EVENT);
    setOpen(true);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!initialAuthed) return;
    try {
      const res = await fetch("/api/product-updates/unread-count");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return;
      }
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // ignore
    }
  }, [initialAuthed]);

  const refreshUpdates = useCallback(async () => {
    if (!initialAuthed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/product-updates");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to load updates");
        setLoading(false);
        return;
      }
      const rows = (data?.updates || []) as ProductUpdateFeedItem[];
      setUpdates(rows);
      setUnreadCount(rows.filter((row) => !row.is_read).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load updates");
    } finally {
      setLoading(false);
    }
  }, [initialAuthed]);

  const refreshSinceLastVisit = useCallback(async () => {
    if (!initialAuthed) return;
    setSinceLoading(true);
    try {
      const res = await fetch("/api/product-updates/since-last-visit");
      const data = (await res.json().catch(() => ({}))) as UpdatesSinceLastVisit;
      if (!res.ok) {
        setSinceLastVisit(null);
        return;
      }
      setSinceLastVisit({
        since: data.since ?? null,
        count_new_since_last_visit: data.count_new_since_last_visit ?? 0,
        latest: Array.isArray(data.latest) ? data.latest : [],
      });
    } catch {
      setSinceLastVisit(null);
    } finally {
      setSinceLoading(false);
    }
  }, [initialAuthed]);

  const markSeen = useCallback(async () => {
    if (!initialAuthed) return;
    try {
      await fetch("/api/me/seen", { method: "POST" });
    } catch {
      // ignore
    }
  }, [initialAuthed]);

  useEffect(() => {
    if (!initialAuthed) return;
    void refreshUnreadCount();
  }, [initialAuthed, refreshUnreadCount]);

  useEffect(() => {
    if (!initialAuthed || seenSentRef.current) return;
    seenSentRef.current = true;
    void (async () => {
      await refreshSinceLastVisit();
      await markSeen();
    })();
  }, [initialAuthed, markSeen, refreshSinceLastVisit]);

  useEffect(() => {
    if (!open) return;
    void refreshUpdates();
  }, [open, refreshUpdates]);

  useEffect(() => {
    if (!open || sinceLastVisit || sinceLoading) return;
    void refreshSinceLastVisit();
  }, [open, refreshSinceLastVisit, sinceLastVisit, sinceLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOpen = () => openDrawer();
    const handleClose = () => closeDrawer();
    const handleHelpOpen = () => closeDrawer();
    window.addEventListener(UPDATES_DRAWER_OPEN_EVENT, handleOpen);
    window.addEventListener(UPDATES_DRAWER_CLOSE_EVENT, handleClose);
    window.addEventListener(HELP_DRAWER_OPEN_EVENT, handleHelpOpen);
    return () => {
      window.removeEventListener(UPDATES_DRAWER_OPEN_EVENT, handleOpen);
      window.removeEventListener(UPDATES_DRAWER_CLOSE_EVENT, handleClose);
      window.removeEventListener(HELP_DRAWER_OPEN_EVENT, handleHelpOpen);
    };
  }, [closeDrawer, openDrawer]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const body = document.body;
    bodyOverflowRef.current = body.style.overflow;
    body.style.overflow = "hidden";

    const focusTarget = closeButtonRef.current ?? drawerRef.current;
    focusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const container = drawerRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])"
        )
      ).filter((node) => !node.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = bodyOverflowRef.current;
    };
  }, [closeDrawer, open]);

  useEffect(() => {
    if (open) return;
    const target = previousActiveRef.current ?? bellButtonRef.current;
    target?.focus();
  }, [open]);

  const markAllRead = async () => {
    if (!initialAuthed) return;
    const res = await fetch("/api/product-updates/read-all", { method: "POST" });
    if (res.ok) {
      setUpdates((prev) => prev.map((row) => ({ ...row, is_read: true })));
      setUnreadCount(0);
    }
  };

  const markRead = async (id: string) => {
    if (!initialAuthed) return;
    const target = updates.find((row) => row.id === id);
    if (!target || target.is_read) return;

    const res = await fetch("/api/product-updates/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updateId: id }),
    });

    if (res.ok) {
      setUpdates((prev) =>
        prev.map((row) => (row.id === id ? { ...row, is_read: true } : row))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  if (!initialAuthed) return null;

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <div className="relative">
      <button
        type="button"
        ref={bellButtonRef}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
        aria-label="Product updates"
        aria-expanded={open}
        onClick={openDrawer}
        data-testid="updates-bell"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9 17a3 3 0 0 0 6 0" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute right-0 top-0 inline-flex h-4 min-w-[1rem] -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white"
            data-testid="updates-badge"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {portalTarget &&
        createPortal(
          <>
            {open && (
              <div className="fixed inset-0 z-[1000]" aria-hidden={!open}>
                <button
                  type="button"
                  className="fixed inset-0 bg-slate-900/40"
                  onClick={closeDrawer}
                  aria-label="Close product updates"
                  data-testid="updates-backdrop"
                />
                <aside
                  ref={drawerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="product-updates-title"
                  tabIndex={-1}
                  className="fixed right-0 top-0 z-[1001] h-dvh w-full max-w-full border-l border-slate-200 bg-white shadow-2xl sm:w-[420px]"
                  data-testid="updates-drawer"
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Inbox</p>
                        <h2 id="product-updates-title" className="text-lg font-semibold text-slate-900">
                          Product updates
                        </h2>
                        <p className="text-xs text-slate-500">What’s new on PropatyHub</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={markAllRead}
                          disabled={!hasUpdates || unreadUpdates === 0}
                          data-testid="updates-mark-all"
                        >
                          Mark all as read
                        </Button>
                        <Button
                          ref={closeButtonRef}
                          variant="secondary"
                          size="sm"
                          onClick={closeDrawer}
                          data-testid="updates-close"
                        >
                          Close
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-3 backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Latest updates
                        </p>
                        {sinceLastVisit && (
                          <p
                            className="mt-1 text-xs text-slate-500"
                            data-testid="updates-since-last-visit"
                          >
                            {sinceLastVisit.count_new_since_last_visit > 0
                              ? `New since your last visit: ${sinceLastVisit.count_new_since_last_visit}`
                              : "You’re all caught up since last visit"}
                          </p>
                        )}
                      </div>

                      <div className="px-6 py-5">
                        {loading && (
                          <div className="mt-4 space-y-3">
                            <div className="h-20 rounded-2xl bg-slate-100" />
                            <div className="h-20 rounded-2xl bg-slate-100" />
                          </div>
                        )}

                        {!loading && error && (
                          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                          </div>
                        )}

                        {!loading && !error && updates.length === 0 && (
                          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                            No updates yet. Check back soon.
                          </div>
                        )}

                        {!loading &&
                          !error &&
                          groupedUpdates.map((group, index) => (
                            <div key={group.key} className={index === 0 ? "" : "mt-6"}>
                              <p
                                className="text-xs uppercase tracking-[0.2em] text-slate-400"
                                data-testid={`updates-month-${group.key}`}
                              >
                                {group.label}
                              </p>
                              <div className="mt-3 space-y-3">
                                {group.items.map((update) => (
                                  <div
                                    key={update.id}
                                    className={cn(
                                      "rounded-2xl border px-4 py-4 text-left transition-colors duration-150 motion-reduce:transition-none",
                                      update.is_read
                                        ? "border-slate-200 bg-white"
                                        : "border-emerald-200 bg-emerald-50/60"
                                    )}
                                    data-testid={`updates-item-${update.id}`}
                                    data-state={update.is_read ? "read" : "unread"}
                                    onClick={() => markRead(update.id)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        markRead(update.id);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          {!update.is_read && (
                                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                              New
                                            </span>
                                          )}
                                          <h3 className="text-sm font-semibold text-slate-900">
                                            {update.title}
                                          </h3>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                          {truncateSummary(update.summary)}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end gap-2">
                                        {update.published_at && (
                                          <p className="text-xs text-slate-400">
                                            {formatDate(update.published_at)}
                                          </p>
                                        )}
                                        <span
                                          aria-hidden="true"
                                          data-testid="update-unread-dot"
                                          data-state={update.is_read ? "read" : "unread"}
                                          className={cn(
                                            "h-2.5 w-2.5 rounded-full bg-emerald-500 transition-all duration-150 motion-reduce:transition-none",
                                            update.is_read ? "scale-75 opacity-0" : "scale-100 opacity-100"
                                          )}
                                        />
                                      </div>
                                    </div>
                                    {update.is_read && (
                                      <span className="sr-only" data-testid="update-read">
                                        Read
                                      </span>
                                    )}
                                    {!update.is_read && (
                                      <div className="mt-3 flex items-center justify-end">
                                        <button
                                          type="button"
                                          className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void markRead(update.id);
                                          }}
                                        >
                                          Mark as read
                                        </button>
                                      </div>
                                    )}
                                    {update.image_url && (
                                      <button
                                        type="button"
                                        className="mt-3 block w-full overflow-hidden rounded-xl border border-slate-200"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setLightboxUrl(update.image_url || null);
                                          void markRead(update.id);
                                        }}
                                      >
                                        <div className="relative h-36 w-full">
                                          <Image
                                            src={update.image_url}
                                            alt="Update screenshot"
                                            fill
                                            sizes="(max-width: 640px) 100vw, 420px"
                                            className="object-cover"
                                          />
                                        </div>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {lightboxUrl && (
              <div
                className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/70 px-4"
                role="dialog"
                aria-modal="true"
                onClick={() => setLightboxUrl(null)}
              >
                <div className="relative max-w-3xl" onClick={(event) => event.stopPropagation()}>
                  <Image
                    src={lightboxUrl}
                    alt="Update screenshot"
                    width={1200}
                    height={800}
                    sizes="90vw"
                    className="h-auto max-h-[80vh] w-auto rounded-2xl object-contain"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => setLightboxUrl(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </>,
          portalTarget
        )}
    </div>
  );
}
