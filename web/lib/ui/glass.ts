import { cn } from "@/components/ui/cn";

export const GLASS_SURFACE_BASE =
  "rounded-full border border-white/18 bg-slate-900/48 text-white backdrop-blur-md backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_20px_rgba(15,23,42,0.24)]";

export function glassSurface(className?: string): string {
  return cn(GLASS_SURFACE_BASE, className);
}
