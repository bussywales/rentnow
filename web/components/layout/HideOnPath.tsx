"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  hiddenPrefixes: string[];
  children: ReactNode;
};

function matchesPrefix(pathname: string | null, prefix: string) {
  if (!pathname) return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function HideOnPath({ hiddenPrefixes, children }: Props) {
  const pathname = usePathname();
  const hidden = hiddenPrefixes.some((prefix) => matchesPrefix(pathname, prefix));

  if (hidden) return null;
  return <>{children}</>;
}
