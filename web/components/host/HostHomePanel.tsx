"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import {
  buildHostHomePanelOpenStorageKey,
  readHostHomePanelOpenPreference,
  toggleHostHomePanelOpenPreference,
  type HostHomePanelKey,
} from "@/lib/host/home-panels-preferences";

type Props = {
  panelKey: HostHomePanelKey;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  testId?: string;
  children: ReactNode;
};

function getClientStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function HostHomePanel({
  panelKey,
  title,
  summary,
  defaultOpen = false,
  className,
  contentClassName,
  testId,
  children,
}: Props) {
  const storageKey = useMemo(
    () => buildHostHomePanelOpenStorageKey(panelKey),
    [panelKey]
  );
  const [open, setOpen] = useState(() =>
    readHostHomePanelOpenPreference(getClientStorage(), panelKey, defaultOpen)
  );

  return (
    <section
      className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}
      data-testid={testId}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() =>
          setOpen((current) =>
            toggleHostHomePanelOpenPreference(getClientStorage(), panelKey, current)
          )
        }
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{summary}</p>
        </div>
        <span className="text-xs font-semibold text-slate-600">
          {open ? "Hide" : "Show more"}
        </span>
      </button>
      {open ? (
        <div className={cn("mt-3 transition-all duration-200 ease-out", contentClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
