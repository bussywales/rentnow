"use client";

import type { ReactNode } from "react";
import { trackProductEvent } from "@/lib/analytics/product-events.client";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  action: string;
  surface: string;
  dedupeKey?: string | null;
};

export function BootcampTrackedTextLink({
  href,
  children,
  className,
  action,
  surface,
  dedupeKey,
}: Props) {
  const handleClick = () => {
    trackProductEvent(
      "bootcamp_cta_clicked",
      {
        category: "bootcamp_launch",
        action,
        surface,
      },
      { dedupeKey }
    );
  };

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
