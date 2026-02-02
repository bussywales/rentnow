"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function LegalAcceptanceGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const current = query ? `${pathname}?${query}` : pathname;
    const target = `/legal/accept?redirect=${encodeURIComponent(current)}`;
    router.replace(target);
  }, [pathname, searchParams, router]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-16 text-sm text-slate-600">
      <h1 className="text-lg font-semibold text-slate-900">Review required</h1>
      <p>Redirecting you to the latest terms and policies.</p>
    </div>
  );
}
