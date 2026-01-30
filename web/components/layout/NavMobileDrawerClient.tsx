"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { normalizeRole } from "@/lib/roles";
import { resolveNavLinks, type NavLink, isActiveHref } from "@/components/layout/NavLinksClient";

type Props = {
  links: NavLink[];
  initialAuthed: boolean;
  initialRole: UserRole | "super_admin" | null;
};

type DrawerLink = {
  href: string;
  label: string;
  showUnread?: boolean;
};

export function buildMobileNavLinks(
  links: NavLink[],
  {
    isAuthed,
    role,
  }: {
    isAuthed: boolean;
    role: UserRole | "super_admin" | null;
  }
): DrawerLink[] {
  const resolved = resolveNavLinks(links, { isAuthed, role });
  const next: DrawerLink[] = [...resolved];
  if (isAuthed) {
    next.push({ href: "/dashboard/messages", label: "Messages", showUnread: true });
  }
  if (!next.find((link) => link.href === "/support")) {
    if (role !== "admin" && role !== "super_admin") {
      next.push({ href: "/support", label: "Support" });
    }
  }
  return next;
}

export function NavMobileDrawerClient({ links, initialAuthed, initialRole }: Props) {
  const normalizedRole =
    initialRole === "super_admin" ? "super_admin" : normalizeRole(initialRole);
  const role = normalizedRole;
  const isAuthed = initialAuthed;
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const drawerLinks = useMemo(() => buildMobileNavLinks(links, { isAuthed, role }), [isAuthed, links, role]);

  useEffect(() => {
    if (!open || !isAuthed) return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/messages/threads");
        if (!res.ok) return;
        const data = await res.json();
        const count = Array.isArray(data?.threads)
          ? data.threads.reduce((sum: number, thread: { unread_count?: number }) => sum + (thread.unread_count ?? 0), 0)
          : 0;
        if (!cancelled) setUnreadCount(count);
      } catch {
        /* ignore */
      }
    };
    void fetchUnread();
    const interval = window.setInterval(fetchUnread, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAuthed, open]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !drawerRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!isAuthed) return null;

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 md:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/60"
            data-testid="mobile-drawer-backdrop"
            onClick={() => setOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            data-testid="mobile-drawer-panel"
            className="relative ml-auto flex h-full w-[80%] max-w-xs flex-col gap-4 border-l border-slate-200 bg-white px-4 py-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Menu</p>
              <button
                ref={closeButtonRef}
                type="button"
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {drawerLinks.map((link) => {
                const active = isActiveHref(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                      active ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <span>{link.label}</span>
                    {link.showUnread && unreadCount > 0 && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-slate-100 pt-4">
              <form action="/auth/logout" method="POST">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
