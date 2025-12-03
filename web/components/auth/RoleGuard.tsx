"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";

type Props = {
  role?: UserRole | null;
  allowed: UserRole[];
  children: React.ReactNode;
  fallback?: string;
};

export function RoleGuard({ role, allowed, children, fallback = "/" }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (role && !allowed.includes(role)) {
      router.replace(fallback);
    }
  }, [allowed, fallback, role, router]);

  if (role && !allowed.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
