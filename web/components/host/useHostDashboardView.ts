"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HOST_DASHBOARD_VIEWS } from "@/lib/host/host-dashboard-microcopy";

export type HostDashboardView = keyof typeof HOST_DASHBOARD_VIEWS;

export function parseHostDashboardView(value: string | null | undefined): HostDashboardView | null {
  if (!value) return null;
  const normalized =
    value === "needs-attention"
      ? "needs_attention"
      : value;
  return normalized in HOST_DASHBOARD_VIEWS ? (normalized as HostDashboardView) : null;
}

export function resolveInitialHostDashboardView(
  urlValue: string | null | undefined,
  storedValue: string | null | undefined
): HostDashboardView {
  const urlView = parseHostDashboardView(urlValue);
  if (urlView) return urlView;
  const storedView = parseHostDashboardView(storedValue);
  if (storedView) return storedView;
  return "all";
}

export function useHostDashboardView(userId?: string | null) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const storageKey = useMemo(
    () => `host_dashboard_last_view_${userId ?? "anon"}`,
    [userId]
  );

  const urlView = useMemo(
    () => parseHostDashboardView(searchParams.get("view")),
    [searchParams]
  );
  const isBookingsContext = useMemo(() => {
    const tab = String(searchParams.get("tab") || "").trim().toLowerCase();
    const section = String(searchParams.get("section") || "").trim().toLowerCase();
    return tab === "bookings" || section === "bookings";
  }, [searchParams]);
  const storedView = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(storageKey);
  }, [storageKey]);
  const view = useMemo(
    () => resolveInitialHostDashboardView(urlView, storedView),
    [storedView, urlView]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, view);
  }, [storageKey, view]);

  useEffect(() => {
    if (isBookingsContext) return;
    if (urlView && urlView === view) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    const nextUrl = `${pathname}?${params.toString()}`;
    router.replace(nextUrl);
  }, [isBookingsContext, pathname, router, searchParams, urlView, view]);

  const setAndPersist = (nextView: HostDashboardView) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, nextView);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    const nextUrl = `${pathname}?${params.toString()}`;
    router.push(nextUrl);
  };

  return { view, setView: setAndPersist };
}
