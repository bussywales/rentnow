"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { buildTabHref, normalizeTabParam, sanitizeAdminSearchParams, type AdminTabKey } from "@/lib/admin/admin-tabs";

type Props = {
  serverSearchParams: Record<string, string | string[] | undefined>;
  countsPending: number;
  listingsCount: number;
};

export function AdminTabNav({ serverSearchParams, countsPending, listingsCount }: Props) {
  const searchParams = useSearchParams();

  const currentTab = normalizeTabParam(
    searchParams?.get("tab") ?? sanitizeAdminSearchParams(serverSearchParams).tab
  );

  const mergedParams = useMemo(() => {
    const obj: Record<string, string | string[] | undefined> = sanitizeAdminSearchParams(serverSearchParams);
    if (searchParams) {
      const entries = Array.from(searchParams.entries());
      for (const [key, value] of entries) {
        const existing = obj[key];
        if (existing === undefined) {
          obj[key] = value;
        } else if (Array.isArray(existing)) {
          obj[key] = [...existing, value];
        } else {
          obj[key] = [existing, value];
        }
      }
    }
    return sanitizeAdminSearchParams(obj);
  }, [searchParams, serverSearchParams]);

  const tabs: Array<{ key: AdminTabKey; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "review", label: `Review queue (${countsPending})` },
    { key: "listings", label: `Listings (${listingsCount})` },
  ];

  return (
    <nav className="flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
      {tabs.map((tab) => {
        const href = buildTabHref(mergedParams, tab.key);
        const active = currentTab === tab.key;
        return (
          <a
            key={tab.key}
            href={href}
            className={`rounded-full border px-3 py-1 text-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
              active
                ? "border-slate-900 bg-white text-slate-900 shadow-sm"
                : "border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300 hover:bg-white"
            }`}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
