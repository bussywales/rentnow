"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import type { WorkspaceRole } from "@/lib/workspace/sidebar-model";

const WORKSPACE_SIDEBAR_COLLAPSED_KEY = "workspace:sidebar:collapsed:v1";

function readCollapsedFromStorage() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WORKSPACE_SIDEBAR_COLLAPSED_KEY) === "1";
}

function writeCollapsedToStorage(next: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKSPACE_SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
}

export function WorkspaceShell({
  role,
  title,
  subtitle,
  children,
  awaitingApprovalCount = 0,
  unreadMessages = 0,
  contentClassName,
}: {
  role: WorkspaceRole;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  awaitingApprovalCount?: number;
  unreadMessages?: number;
  contentClassName?: string;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsedFromStorage);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      writeCollapsedToStorage(next);
      return next;
    });
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl px-4">
      <div className="min-w-0 py-4">
        <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open workspace navigation"
            data-testid="workspace-mobile-nav-open"
          >
            Menu
          </button>
          {title ? (
            <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
          ) : (
            <span />
          )}
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden" data-testid="workspace-mobile-drawer">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/35"
              onClick={() => setMobileOpen(false)}
              aria-label="Close workspace navigation"
            />
            <div className="absolute left-0 top-0 h-full w-[min(85vw,20rem)] p-3">
              <WorkspaceSidebar
                role={role}
                awaitingApprovalCount={awaitingApprovalCount}
                unreadMessages={unreadMessages}
                onNavigate={() => setMobileOpen(false)}
                showToggle={false}
                className="h-full overflow-y-auto"
              />
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "min-w-0 md:grid md:items-start md:gap-6",
            collapsed ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[256px_minmax(0,1fr)]"
          )}
          data-testid="workspace-shell-grid"
        >
          <div className="hidden min-w-0 md:block" data-testid="workspace-shell-sidebar-region">
            <WorkspaceSidebar
              role={role}
              awaitingApprovalCount={awaitingApprovalCount}
              unreadMessages={unreadMessages}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
            />
          </div>
          <div className={cn("min-w-0", contentClassName)} data-testid="workspace-shell-main">
            {title ? (
              <div className="mb-4 rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Dashboard</p>
                <p className="text-xl font-semibold">{title}</p>
                {subtitle ? <p className="text-sm text-slate-200">{subtitle}</p> : null}
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
