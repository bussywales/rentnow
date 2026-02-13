"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { normalizeRole } from "@/lib/roles";
import { resolveNavLinks, type NavLink, isActiveHref } from "@/components/layout/NavLinksClient";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { MarketSelector } from "@/components/layout/MarketSelector";

type Props = {
  links: NavLink[];
  initialAuthed: boolean;
  initialRole: UserRole | "super_admin" | null;
  marketSelectorEnabled: boolean;
};

type DrawerLink = {
  href: string;
  label: string;
  showUnread?: boolean;
};

const LOGGED_OUT_LINKS: DrawerLink[] = [
  { href: "/help", label: "Help Centre" },
  { href: "/onboarding", label: "Become a host" },
  { href: "/agents", label: "Find an agent" },
  { href: "/auth/login", label: "Log in" },
  { href: "/auth/register", label: "Sign up" },
];

function getRoleHelpHref(role: UserRole | "super_admin" | null): string {
  if (role === "tenant") return "/help/tenant";
  if (role === "landlord") return "/help/landlord";
  if (role === "agent") return "/help/agent";
  if (role === "admin" || role === "super_admin") return "/help/admin";
  return "/help";
}

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
  if (!next.find((link) => link.href === "/profile")) {
    next.unshift({ href: "/profile", label: "Profile" });
  }
  if (isAuthed) {
    next.push({ href: "/dashboard/messages", label: "Messages", showUnread: true });
  }
  if (isAuthed) {
    const helpHref = getRoleHelpHref(role);
    if (!next.find((link) => link.href === helpHref)) {
      next.push({ href: helpHref, label: "Help Centre" });
    }
  }
  if (!next.find((link) => link.href === "/support")) {
    if (role !== "admin" && role !== "super_admin") {
      next.push({ href: "/support", label: "Contact support" });
    }
  }
  return next;
}

export function NavMobileDrawerClient({
  links,
  initialAuthed,
  initialRole,
  marketSelectorEnabled,
}: Props) {
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

  const drawerLinks = useMemo(
    () => (isAuthed ? buildMobileNavLinks(links, { isAuthed, role }) : LOGGED_OUT_LINKS),
    [isAuthed, links, role]
  );

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
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
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
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-label="Open menu"
        data-testid="hamburger-menu"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex">
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-[10000] bg-black/50"
              data-testid="mobile-drawer-overlay"
              onClick={() => setOpen(false)}
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              data-testid="mobile-drawer-panel"
              className="fixed right-0 top-0 z-[10001] flex h-[100dvh] w-[85vw] max-w-[420px] flex-col bg-white shadow-2xl"
            >
              <div
                className="flex items-center justify-between px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]"
              >
                <BrandLogo variant="header" size="sm" />
                <button
                  ref={closeButtonRef}
                  type="button"
                  data-testid="mobile-drawer-close"
                  aria-label="Close menu"
                  className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
              <div
                data-testid="mobile-drawer-scroll"
                className="flex-1 min-h-0 overflow-y-auto px-4 pb-4"
              >
                {marketSelectorEnabled ? (
                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Market
                    </p>
                    <MarketSelector enabled compact />
                  </div>
                ) : null}
                <nav className="flex flex-col gap-2">
                  {drawerLinks.map((link) => {
                    const active = isActiveHref(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                          active
                            ? "bg-slate-100 font-semibold text-slate-900"
                            : "text-slate-700 hover:bg-slate-50"
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
              </div>
              {isAuthed ? (
                <div
                  data-testid="mobile-drawer-footer"
                  className="border-t border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]"
                >
                  <form action="/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Log out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
