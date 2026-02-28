"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

type GlassPillProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "light" | "dark";
};

const BASE_PILL_CLASSES =
  "rounded-full border backdrop-blur-md backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_8px_22px_rgba(15,23,42,0.24)]";

const VARIANT_CLASSES: Record<NonNullable<GlassPillProps["variant"]>, string> = {
  light: "border-white/45 bg-white/45 text-slate-900",
  dark: "border-white/18 bg-slate-900/48 text-white",
};

export function GlassPill({ variant = "dark", className, ...props }: GlassPillProps) {
  return <div className={cn(BASE_PILL_CLASSES, VARIANT_CLASSES[variant], className)} {...props} />;
}

