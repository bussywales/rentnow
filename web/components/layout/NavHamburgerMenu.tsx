"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { normalizeRole } from "@/lib/roles";
import { openProductUpdatesDrawer } from "@/lib/ui/overlay-events";

type Props = {
  initialAuthed: boolean;
  initialRole?: string | null;
};

type MenuItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  testId: string;
};

export function NavHamburgerMenu({ initialAuthed, initialRole = null }: Props) {
  const role = normalizeRole(initialRole);
  const isAuthed = initialAuthed;
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const items = useMemo(() => {
    if (!isAuthed) {
      return [
        { label: "Help Centre", href: "/help", testId: "menu-item-help" },
        { label: "Become a host", href: "/onboarding", testId: "menu-item-become-host" },
        { label: "Find an agent", href: "/agents", testId: "menu-item-agents" },
        { label: "Log in", href: "/auth/login", testId: "menu-item-login" },
        { label: "Sign up", href: "/auth/register", testId: "menu-item-signup" },
      ] satisfies MenuItem[];
    }

    if (role === "tenant") {
      return [
        { label: "Browse", href: "/properties", testId: "menu-item-browse" },
        { label: "Saved", href: "/tenant/saved", testId: "menu-item-saved" },
        { label: "Help Centre", href: "/help", testId: "menu-item-help" },
        { label: "Settings", href: "/tenant/billing", testId: "menu-item-settings" },
      ] satisfies MenuItem[];
    }

    if (role === "admin") {
      return [
        { label: "Admin", href: "/admin", testId: "menu-item-admin" },
        { label: "Insights", href: "/admin/insights", testId: "hamburger-admin-insights" },
        { label: "Updates inbox", onClick: openProductUpdatesDrawer, testId: "menu-item-updates" },
        { label: "Ops docs", href: "/help/admin", testId: "menu-item-ops-docs" },
        { label: "Settings", href: "/admin/settings", testId: "menu-item-settings" },
      ] satisfies MenuItem[];
    }

    return [
      { label: "Host dashboard", href: "/host", testId: "menu-item-dashboard" },
      { label: "My listings", href: "/host/listings", testId: "menu-item-listings" },
      { label: "Help Centre", href: "/help", testId: "menu-item-help" },
      { label: "Settings", href: "/dashboard/settings/verification", testId: "menu-item-settings" },
    ] satisfies MenuItem[];
  }, [isAuthed, role]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!menuRef.current || !target) return;
      if (menuRef.current.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!isAuthed && !items.length) return null;

  return (
    <div className="relative hidden md:inline-flex">
      <button
        type="button"
        ref={buttonRef}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50"
        data-testid="hamburger-menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-11 z-40 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
          data-testid="hamburger-menu-panel"
        >
          <div className="flex flex-col gap-1">
            {items.map((item) =>
              item.href ? (
                <Link
                  key={item.testId}
                  href={item.href}
                  className="rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  data-testid={item.testId}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.testId}
                  type="button"
                  className="rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  data-testid={item.testId}
                  onClick={() => {
                    item.onClick?.();
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              )
            )}
          </div>

          {isAuthed && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <form action="/auth/logout" method="POST">
                <button
                  type="submit"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50"
                  data-testid="menu-item-logout"
                >
                  Log out
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
