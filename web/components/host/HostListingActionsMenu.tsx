"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

type Props = {
  listingId: string;
  tone?: "light" | "dark";
  className?: string;
};

export function HostListingActionsMenu({ listingId, tone = "light", className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = `host-listing-actions-panel-${listingId}`;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      data-testid={`host-listing-actions-menu-${listingId}`}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
          tone === "dark"
            ? "border-white/35 bg-white/15 text-white hover:bg-white/20"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
        )}
        aria-label="More actions"
        aria-expanded={open}
        aria-controls={panelId}
      >
        ...
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute bottom-full right-0 z-40 mb-1.5 min-w-[170px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
          data-testid={panelId}
        >
          <Link
            href={`/host/properties/${listingId}/availability`}
            className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Availability
          </Link>
          <Link
            href={`/host/shortlets/${listingId}/settings`}
            className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Shortlet settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
