import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/components/ui/cn";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
