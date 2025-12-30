"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PropertyMapClient } from "@/components/properties/PropertyMapClient";
import type { Property } from "@/lib/types";
import { cn } from "@/components/ui/cn";

type Props = {
  properties: Property[];
  height?: string;
  title?: string;
  description?: string;
  variant?: "card" | "inline";
  defaultOpen?: boolean;
};

export function PropertyMapToggle({
  properties,
  height = "360px",
  title = "Map preview",
  description = "See listings plotted by city and neighbourhood.",
  variant = "card",
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const wrapperClass =
    variant === "card"
      ? "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      : "space-y-3";
  const placeholderClass =
    variant === "card"
      ? "rounded-2xl border border-dashed border-slate-200 bg-slate-50"
      : "rounded-2xl border border-dashed border-slate-200 bg-slate-50";

  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={cn("font-semibold text-slate-900", variant === "card" ? "text-base" : "text-sm")}>
            {title}
          </p>
          {description && (
            <p className="text-xs text-slate-600">{description}</p>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          {open ? "Hide map" : "Show map"}
        </Button>
      </div>
      {open ? (
        <div className="mt-3">
          <PropertyMapClient properties={properties} height={height} />
        </div>
      ) : (
        <div
          className={cn(
            "mt-3 flex items-center justify-center text-sm text-slate-500",
            placeholderClass
          )}
          style={{ height }}
        >
          Map preview available.
        </div>
      )}
    </div>
  );
}
