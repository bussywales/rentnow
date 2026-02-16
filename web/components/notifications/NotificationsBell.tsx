"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveUnreadNotificationsCount } from "@/lib/notifications/badge";
import { cn } from "@/components/ui/cn";
import type { UserRole } from "@/lib/types";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  is_read: boolean;
  created_at: string;
};

type Props = {
  initialAuthed: boolean;
  initialRole: UserRole | "super_admin" | null;
};

const REFRESH_MS = 60_000;

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function NotificationsBell({ initialAuthed, initialRole }: Props) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const canShow =
    initialRole === "tenant" ||
    initialRole === "landlord" ||
    initialRole === "agent" ||
    initialRole === "admin" ||
    initialRole === "super_admin";

  const viewAllHref = initialRole === "tenant" ? "/trips" : "/host?tab=bookings";

  const refresh = useCallback(async () => {
    if (!initialAuthed || !canShow) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { notifications?: NotificationItem[]; unreadCount?: number; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load notifications");
      }

      const notifications = Array.isArray(payload?.notifications) ? payload.notifications : [];
      setItems(notifications);
      setUnreadCount(resolveUnreadNotificationsCount(notifications, payload?.unreadCount ?? null));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }, [canShow, initialAuthed]);

  const markRead = useCallback(async (ids?: string[]) => {
    if (!initialAuthed || !canShow) return;

    await fetch("/api/notifications/mark-read", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids?.length ? { ids } : {}),
    }).catch(() => null);
  }, [canShow, initialAuthed]);

  useEffect(() => {
    if (!initialAuthed || !canShow) return undefined;

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [canShow, initialAuthed, refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapperRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
    };
  }, [open]);

  const hasItems = items.length > 0;
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [items]
  );

  if (!initialAuthed || !canShow) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        aria-label="Open notifications"
        data-testid="notifications-bell"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            d="M6.75 9.5a5.25 5.25 0 0 1 10.5 0v3.122c0 .915.336 1.798.945 2.481l.316.355A1 1 0 0 1 17.77 17H6.23a1 1 0 0 1-.74-1.542l.316-.355A3.75 3.75 0 0 0 6.75 12.62V9.5Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9.75 17.5a2.25 2.25 0 0 0 4.5 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unreadCount > 0 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {unreadCount} unread
              </span>
            ) : null}
          </div>

          <div className="max-h-[22rem] overflow-y-auto p-2">
            {loading ? <p className="px-2 py-3 text-sm text-slate-500">Loading notifications...</p> : null}
            {error ? <p className="px-2 py-3 text-sm text-rose-600">{error}</p> : null}
            {!loading && !error && !hasItems ? (
              <p className="px-2 py-3 text-sm text-slate-500">No notifications yet.</p>
            ) : null}

            {!loading && !error
              ? sortedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={async () => {
                      setItems((prev) =>
                        prev.map((row) =>
                          row.id === item.id
                            ? {
                                ...row,
                                is_read: true,
                              }
                            : row
                        )
                      );
                      setUnreadCount((prev) => (item.is_read ? prev : Math.max(0, prev - 1)));
                      await markRead([item.id]);
                      setOpen(false);
                      router.push(item.href || viewAllHref);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 rounded-xl px-2 py-2 text-left hover:bg-slate-50",
                      item.is_read ? "text-slate-600" : "bg-slate-50/80 text-slate-900"
                    )}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-5">{item.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-500">{formatRelativeTime(item.created_at)}</span>
                    </div>
                    <p className="w-full text-xs leading-5 text-slate-600">{item.body}</p>
                  </button>
                ))
              : null}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              onClick={async () => {
                await markRead();
                setItems((prev) => prev.map((row) => ({ ...row, is_read: true })));
                setUnreadCount(0);
              }}
            >
              Mark all read
            </button>
            <Link
              href={viewAllHref}
              className="text-xs font-semibold text-sky-700 hover:text-sky-900"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
