"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function DashboardLeadsLegacyRedirectPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const target = `/host/leads${query ? `?${query}` : ""}${hash}`;
    window.location.replace(target);
  }, [searchParams]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
      <p className="font-medium text-slate-900">Leads has moved into the host workspace.</p>
      <p className="mt-1">Redirecting to /host/leads…</p>
      <Link
        href="/host/leads"
        className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Continue now
      </Link>
    </div>
  );
}
