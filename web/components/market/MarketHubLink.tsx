"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  extractSearchParamsFromHref,
  setLastBrowseIntent,
} from "@/lib/market/browse-intent";

type Props = {
  href: string;
  country: string;
  label: string;
  className?: string;
  children: ReactNode;
};

export function MarketHubLink({ href, country, label, className, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        setLastBrowseIntent({
          lastSearchParams: extractSearchParamsFromHref(href),
          lastHub: {
            country,
            label,
            href,
          },
        });
      }}
    >
      {children}
    </Link>
  );
}

