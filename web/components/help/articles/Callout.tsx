import type { PropsWithChildren } from "react";
import { cn } from "@/components/ui/cn";

type Props = PropsWithChildren<{
  type?: "info" | "warning" | "success";
}>;

const STYLES: Record<NonNullable<Props["type"]>, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function Callout({ type = "info", children }: Props) {
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", STYLES[type])}>
      {children}
    </div>
  );
}
