import Link from "next/link";

export type AdminAnalyticsDestinationKey = "marketplace" | "explore" | "explore_v2";

export const ADMIN_ANALYTICS_DESTINATIONS: Array<{
  key: AdminAnalyticsDestinationKey;
  href: string;
  label: string;
  description: string;
}> = [
  {
    key: "marketplace",
    href: "/admin/analytics",
    label: "Marketplace analytics",
    description: "Core marketplace health, demand funnel, and system snapshot.",
  },
  {
    key: "explore",
    href: "/admin/analytics/explore",
    label: "Explore analytics",
    description: "Explore telemetry events, exports, and tracking controls.",
  },
  {
    key: "explore_v2",
    href: "/admin/analytics/explore-v2",
    label: "Explore V2 conversion",
    description: "Micro-sheet conversion metrics for opens, primary, details, save, and share.",
  },
];

export function AdminAnalyticsSectionNav({
  current,
}: {
  current: AdminAnalyticsDestinationKey;
}) {
  return (
    <nav
      aria-label="Analytics destinations"
      className="flex flex-wrap items-center gap-2"
      data-testid="admin-analytics-sibling-nav"
    >
      {ADMIN_ANALYTICS_DESTINATIONS.map((item) => {
        const isActive = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            data-testid={`admin-analytics-nav-${item.key}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              isActive
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
