"use client";

import { type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "@/components/ui/cn";

type HorizontalSnapRailProps = {
  children: ReactNode;
  className?: string;
  scrollerClassName?: string;
  trackClassName?: string;
  labelledById?: string;
  testId?: string;
  scrollerRef?: Ref<HTMLDivElement>;
  scrollerProps?: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;
};

export function HorizontalSnapRail({
  children,
  className,
  scrollerClassName,
  trackClassName,
  labelledById,
  testId,
  scrollerRef,
  scrollerProps,
}: HorizontalSnapRailProps) {
  return (
    <div className={cn("w-full min-w-0 max-w-full overflow-x-clip", className)}>
      <div
        ref={scrollerRef}
        data-testid={testId}
        aria-labelledby={labelledById}
        className={cn(
          "scrollbar-none min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] scroll-smooth",
          scrollerClassName
        )}
        {...scrollerProps}
      >
        <div className={cn("flex w-max min-w-full max-w-full snap-x snap-mandatory gap-3", trackClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
