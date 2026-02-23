"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import {
  getWorkspaceSidebarItems,
  type WorkspaceRole,
} from "@/lib/workspace/sidebar-model";

type WorkspaceSidebarProps = {
  role: WorkspaceRole;
  awaitingApprovalCount?: number | null;
  unreadMessages?: number | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  className?: string;
  showToggle?: boolean;
};

function isActive(pathname: string, href: string) {
  if (href === "/host") return pathname === "/host";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar({
  role,
  awaitingApprovalCount = 0,
  unreadMessages = 0,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  className,
  showToggle = true,
}: WorkspaceSidebarProps) {
  const pathname = usePathname() || "/";
  const items = getWorkspaceSidebarItems({
    role,
    awaitingApprovalCount,
    unreadMessages,
  });

  if (!items.length) return null;

  return (
    <aside
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-3 shadow-sm",
        className
      )}
      data-testid="workspace-sidebar"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        {!collapsed ? (
          <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Workspace
          </p>
        ) : (
          <span className="sr-only">Workspace navigation</span>
        )}
        {showToggle ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-testid="workspace-sidebar-toggle"
          >
            {collapsed ? ">>" : "<<"}
          </button>
        ) : null}
      </div>

      <nav className="space-y-1" aria-label="Workspace">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between rounded-lg px-2.5 py-2 text-sm transition",
                active
                  ? "bg-sky-50 font-semibold text-sky-700"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    active
                      ? "border-sky-300 bg-sky-100 text-sky-700"
                      : "border-slate-300 bg-slate-100 text-slate-700"
                  )}
                  aria-hidden="true"
                >
                  {item.label.charAt(0)}
                </span>
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </span>
              {(item.badgeCount ?? 0) > 0 ? (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                  {item.badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
