"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

function ShortletsSearchShellFallback() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-4 overflow-x-hidden px-4 py-4 lg:overflow-x-visible"
      data-testid="shortlets-search-shell"
      aria-busy="true"
    >
      <div data-testid="shortlets-shell-background">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Shortlets</p>
          <h1 className="text-2xl font-semibold text-slate-900">Find shortlets anywhere</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search by area, landmark, and dates. Map prices are nightly and availability-aware.
          </p>
          <p className="mt-1 text-xs text-slate-500">Loading shortlet search…</p>
        </section>
      </div>
    </div>
  );
}

const ShortletsSearchShellClient = dynamic(
  () =>
    import("./ShortletsSearchShell").then((mod) => ({
      default: mod.ShortletsSearchShell,
    })),
  {
    ssr: false,
    loading: ShortletsSearchShellFallback,
  }
);

type Props = {
  initialSearchParams?: Record<string, string | string[] | undefined>;
  initialViewerRole?: "tenant" | "landlord" | "agent" | "admin" | null;
};

let hasMountedSnapshot = false;
let mountNotificationQueued = false;
let rafHandle: number | null = null;
const mountListeners = new Set<() => void>();

function flushMountedSnapshot() {
  hasMountedSnapshot = true;
  mountNotificationQueued = false;
  rafHandle = null;
  for (const listener of mountListeners) {
    listener();
  }
}

function queueMountedSnapshot() {
  if (hasMountedSnapshot || mountNotificationQueued) return;
  mountNotificationQueued = true;

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    rafHandle = window.requestAnimationFrame(() => {
      flushMountedSnapshot();
    });
    return;
  }

  setTimeout(() => {
    flushMountedSnapshot();
  }, 0);
}

function subscribeToMountState(listener: () => void) {
  mountListeners.add(listener);
  queueMountedSnapshot();
  return () => {
    mountListeners.delete(listener);
    if (!mountListeners.size && rafHandle !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
      mountNotificationQueued = false;
    }
  };
}

function getClientMountedSnapshot() {
  return hasMountedSnapshot;
}

function getServerMountedSnapshot() {
  return false;
}

export function ShortletsSearchShellNoSsr(props: Props) {
  const hasMounted = useSyncExternalStore(
    subscribeToMountState,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  );

  if (!hasMounted) {
    return <ShortletsSearchShellFallback />;
  }

  return <ShortletsSearchShellClient {...props} />;
}
