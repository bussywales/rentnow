import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/components/ui/cn";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
