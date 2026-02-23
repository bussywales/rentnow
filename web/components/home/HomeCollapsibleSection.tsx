"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import {
  readCollapsedPreference,
  toggleCollapsedPreference,
} from "@/lib/home/collapsible";

type Props = {
  title: string;
  description?: string;
  storageKey: string;
  defaultCollapsed?: boolean;
  className?: string;
  contentClassName?: string;
  testId?: string;
  children: ReactNode;
};

function getClientStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function HomeCollapsibleSection({
  title,
  description,
  storageKey,
  defaultCollapsed = true,
  className,
  contentClassName,
  testId,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState(() =>
    readCollapsedPreference(getClientStorage(), storageKey, defaultCollapsed)
  );

  return (
    <section
      className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() =>
          setCollapsed((current) =>
            toggleCollapsedPreference(getClientStorage(), storageKey, current)
          )
        }
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={!collapsed}
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        <span className="text-xs font-semibold text-slate-600">
          {collapsed ? "Show" : "Hide"}
        </span>
      </button>
      {!collapsed ? <div className={cn("mt-3", contentClassName)}>{children}</div> : null}
    </section>
  );
}
