"use client";

import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { trackProductEvent } from "@/lib/analytics/product-events.client";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  action: string;
  surface: string;
  dedupeKey?: string | null;
};

export function BootcampTrackedButtonLink({
  href,
  children,
  className,
  variant,
  size,
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
    <ButtonLink
      href={href}
      className={className}
      variant={variant}
      size={size}
      onClick={handleClick}
    >
      {children}
    </ButtonLink>
  );
}
