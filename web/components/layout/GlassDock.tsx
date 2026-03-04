"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { GlassDockSearchOverlay } from "@/components/layout/GlassDockSearchOverlay";
import { useScrollDirection, type ScrollDirection } from "@/lib/ui/useScrollDirection";
import { useScrollIdle } from "@/lib/ui/useScrollIdle";

type DockRoute = {
  id: string;
  href: string;
  label: string;
  testId: string;
  icon: ReactNode;
};

type ResolveGlassDockCollapsedInput = {
  direction: ScrollDirection;
  isNearBottomNavSafeZone: boolean;
  searchOpen: boolean;
};

const HIDE_PREFIXES = ["/admin", "/auth"];

const DOCK_ROUTES: DockRoute[] = [
  {
    id: "home",
    href: "/",
    label: "Home",
    testId: "glass-dock-link-home",
    icon: (
      <path
        d="M3 11.5 12 4l9 7.5v8.5h-6v-5h-6v5H3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "explore",
    href: "/explore-v2",
    label: "Explore",
    testId: "glass-dock-link-explore-v2",
    icon: (
      <path
        d="m4 20 5.5-13.5L23 1 17.5 14.5zM9.5 6.5l8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "saved",
    href: "/tenant/saved",
    label: "Saved",
    testId: "glass-dock-link-saved",
    icon: (
      <path
        d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "profile",
    href: "/profile",
    label: "Profile",
    testId: "glass-dock-link-profile",
    icon: (
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 1 1 14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
  },
];

export function resolveGlassDockCollapsedState(input: ResolveGlassDockCollapsedInput): boolean {
  if (input.searchOpen) return false;
  if (input.isNearBottomNavSafeZone) return false;
  return input.direction === "down";
}

function isRouteHidden(pathname: string | null) {
  if (!pathname) return false;
  return HIDE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isActiveRoute(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlassDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nearMe, setNearMe] = useState(false);
  const { direction, isNearBottomNavSafeZone } = useScrollDirection();
  const { isScrolling } = useScrollIdle({ idleMs: 140 });
  const routeHidden = isRouteHidden(pathname);
  const dockLinks = useMemo(() => DOCK_ROUTES, []);
  const collapsed = useMemo(
    () =>
      resolveGlassDockCollapsedState({
        direction,
        isNearBottomNavSafeZone,
        searchOpen,
      }),
    [direction, isNearBottomNavSafeZone, searchOpen]
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const next = new URLSearchParams();
    const trimmed = searchQuery.trim();
    if (trimmed.length > 0) {
      next.set("q", trimmed);
    }
    if (nearMe) {
      next.set("near", "me");
    }
    const href = next.toString() ? `/properties?${next.toString()}` : "/properties";
    closeSearch();
    router.push(href);
  }, [closeSearch, nearMe, router, searchQuery]);

  const handleSearchReset = useCallback(() => {
    setSearchQuery("");
    setNearMe(false);
  }, []);

  if (routeHidden) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-3 md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.4rem)" }}
      >
        <div
          className={cn(
            "pointer-events-auto mx-auto w-full max-w-md rounded-[1.75rem] border border-white/45 bg-white/70 transition-all duration-200 motion-reduce:transition-none",
            isScrolling
              ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_32px_rgba(15,23,42,0.16)]"
              : "backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_32px_rgba(15,23,42,0.16)]",
            collapsed && !searchOpen ? "py-1.5" : "py-2.5"
          )}
          data-testid="glass-dock"
          data-collapsed={collapsed ? "true" : "false"}
          data-scrolling={isScrolling ? "true" : "false"}
        >
          <div className="flex items-center gap-1 px-2">
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1 transition-all duration-200",
                searchOpen ? "max-w-[70%]" : "max-w-full"
              )}
            >
              {dockLinks.map((route) => {
                const active = isActiveRoute(pathname, route.href);
                return (
                  <Link
                    key={route.id}
                    href={route.href}
                    className={cn(
                      "group inline-flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[10px] font-semibold transition",
                      active
                        ? "bg-slate-900/82 text-white"
                        : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                    )}
                    data-testid={route.testId}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px] shrink-0">
                      {route.icon}
                    </svg>
                    <span className={cn("truncate", collapsed && !searchOpen ? "sr-only" : "block")}>
                      {route.label}
                    </span>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-2xl border border-white/50 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-700 transition",
                "hover:bg-white/80",
                searchOpen ? "w-[30%]" : "w-auto"
              )}
              onClick={() => setSearchOpen((current) => !current)}
              data-testid="glass-dock-search-trigger"
              aria-expanded={searchOpen}
              aria-controls="glass-dock-search-overlay"
              aria-label="Open search"
            >
              <span className={cn(searchOpen ? "sr-only" : "inline")}>Search</span>
              <svg viewBox="0 0 24 24" aria-hidden className={cn("h-4 w-4", searchOpen ? "inline" : "hidden")}>
                <path
                  d="M6 6l12 12M18 6 6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <GlassDockSearchOverlay
        open={searchOpen}
        query={searchQuery}
        nearMe={nearMe}
        onQueryChange={setSearchQuery}
        onToggleNearMe={() => setNearMe((current) => !current)}
        onReset={handleSearchReset}
        onClose={closeSearch}
        onSubmit={handleSearchSubmit}
      />
    </>
  );
}
