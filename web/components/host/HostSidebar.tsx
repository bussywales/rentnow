"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import type { UserRole } from "@/lib/types";

type HostSidebarProps = {
  role: UserRole | "super_admin" | null;
  awaitingApprovalCount?: number;
  unreadMessages?: number;
};

const HOST_SIDEBAR_COLLAPSED_KEY = "host:sidebar:collapsed:v1";

function readCollapsedFromStorage() {
  if (typeof window === "undefined") return false;
  const value = window.localStorage.getItem(HOST_SIDEBAR_COLLAPSED_KEY);
  return value === "1";
}

function writeCollapsedToStorage(next: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOST_SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
}

type SidebarItem = {
  href: string;
  label: string;
  badgeCount?: number | null;
};

function buildSidebarItems(awaitingApprovalCount: number): SidebarItem[] {
  return [
    { href: "/host", label: "Overview" },
    { href: "/host/bookings", label: "Bookings", badgeCount: awaitingApprovalCount || null },
    { href: "/host/calendar", label: "Calendar" },
    { href: "/host/listings", label: "Listings" },
    { href: "/host/earnings", label: "Earnings" },
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/host") return pathname === "/host";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HostSidebar({
  role,
  awaitingApprovalCount = 0,
  unreadMessages = 0,
}: HostSidebarProps) {
  const pathname = usePathname() || "/host";
  const [collapsed, setCollapsed] = useState(readCollapsedFromStorage);
  const items = useMemo(() => buildSidebarItems(awaitingApprovalCount), [awaitingApprovalCount]);

  if (role === "tenant" || role === "admin") return null;

  return (
    <aside
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all",
        collapsed ? "w-full md:w-20" : "w-full md:w-64"
      )}
      data-testid="host-sidebar"
    >
      <div className="mb-3 flex items-center justify-between">
        {!collapsed ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Host</p>
        ) : (
          <span className="sr-only">Host navigation</span>
        )}
        <button
          type="button"
          onClick={() =>
            setCollapsed((current) => {
              const next = !current;
              writeCollapsedToStorage(next);
              return next;
            })
          }
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-testid="host-sidebar-toggle"
        >
          {collapsed ? ">>" : "<<"}
        </button>
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between rounded-lg px-2.5 py-2 text-sm transition",
                active
                  ? "bg-sky-50 font-semibold text-sky-700"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    active
                      ? "border-sky-300 bg-sky-100 text-sky-700"
                      : "border-slate-300 bg-slate-100 text-slate-700"
                  )}
                  aria-hidden="true"
                >
                  {item.label.charAt(0)}
                </span>
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </span>
              {(item.badgeCount ?? 0) > 0 ? (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                  {item.badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Messages</p>
          <p className="mt-0.5">
            {unreadMessages > 0 ? `${unreadMessages} unread conversations` : "No unread conversations"}
          </p>
          <Link href="/dashboard/messages" className="mt-1 inline-flex font-semibold text-sky-700">
            Open inbox
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
