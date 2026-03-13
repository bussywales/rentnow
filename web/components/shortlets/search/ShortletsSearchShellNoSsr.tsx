"use client";

import dynamic from "next/dynamic";

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

export function ShortletsSearchShellNoSsr(props: Props) {
  return <ShortletsSearchShellClient {...props} />;
}
