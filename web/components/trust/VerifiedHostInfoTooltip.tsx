"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";

type Props = {
  className?: string;
};

const VERIFIED_HOST_COPY =
  "Verified means the host has completed at least one verification step (email, phone, or bank). More verification levels are coming.";

export function VerifiedHostInfoTooltip({ className }: Props) {
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapperRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label="What does verified mean?"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setOpen((current) => !current);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        data-testid="verified-host-tooltip-trigger"
      >
        ?
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="dialog"
          aria-label="Verified host details"
          className="absolute right-0 top-5 z-30 w-60 rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-4 text-slate-600 shadow-lg"
          data-testid="verified-host-tooltip-content"
        >
          {VERIFIED_HOST_COPY}
        </span>
      ) : null}
    </span>
  );
}

export { VERIFIED_HOST_COPY };
