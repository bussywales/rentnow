"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { HelpNavSection } from "@/components/help/help-nav";

function isActivePath(current: string, target: string) {
  if (current === target) return true;
  if (target !== "/help/admin" && current.startsWith(target)) return true;
  return false;
}

export function HelpSidebar({ sections }: { sections: HelpNavSection[] }) {
  const pathname = usePathname();

  return (
    <aside
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="help-sidebar"
    >
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {section.title}
            </p>
            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-2 py-1.5 text-sm transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    data-testid={`help-sidebar-link-${item.href.replace(/\//g, "-")}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
