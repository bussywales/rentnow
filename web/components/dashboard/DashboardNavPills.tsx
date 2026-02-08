import Link from "next/link";
import type { DashboardNavItem } from "@/lib/dashboard/nav";

type Props = {
  items: DashboardNavItem[];
  unreadMessages?: number;
};

export function DashboardNavPills({ items, unreadMessages = 0 }: Props) {
  const visibleItems = items.filter((item) => item.show);
  if (!visibleItems.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {visibleItems.map((item) => (
        <Link key={item.key || item.href} href={item.href} className="rounded-full bg-white/10 px-3 py-1">
          {item.showUnread ? (
            <span className="inline-flex items-center gap-2">
              {item.label}
              {unreadMessages > 0 && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                  {unreadMessages}
                </span>
              )}
            </span>
          ) : (
            item.label
          )}
        </Link>
      ))}
    </div>
  );
}
