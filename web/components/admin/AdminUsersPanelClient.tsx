"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AdminUserBadge } from "@/components/admin/AdminUserBadge";
import { AdminUserDrawer } from "@/components/admin/AdminUserDrawer";
import {
  DEFAULT_ADMIN_USERS_QUERY,
  getAdminUserStatus,
  serializeAdminUsersQuery,
  type AdminUserRow,
  type AdminUsersQuery,
} from "@/lib/admin/admin-users";
import { normalizePlanTier } from "@/lib/plans";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";
import { cn } from "@/components/ui/cn";

type Props = {
  users: AdminUserRow[];
  query: AdminUsersQuery;
  totalCount: number;
  pageCount: number;
  pendingCount: number;
  serviceReady: boolean;
  actionsDisabled: boolean;
  showOnboardingBanner: boolean;
  truncated: boolean;
};

const planLabelMap: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  tenant_pro: "Tenant Pro",
};

const statusLabelMap = {
  active: "Active",
  pending: "Pending",
  incomplete: "Incomplete",
  missing: "Profile missing",
} as const;

const statusToneMap = {
  active: "emerald",
  pending: "amber",
  incomplete: "slate",
  missing: "rose",
} as const;

const roleToneMap: Record<string, "sky" | "emerald" | "slate"> = {
  admin: "sky",
  landlord: "emerald",
  agent: "emerald",
  tenant: "slate",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return value.replace("T", " ").replace("Z", "");
};

export function AdminUsersPanelClient({
  users,
  query,
  totalCount,
  pageCount,
  pendingCount,
  serviceReady,
  actionsDisabled,
  showOnboardingBanner,
  truncated,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyQuery = useCallback(
    (next: AdminUsersQuery, options?: { replace?: boolean }) => {
      const params = serializeAdminUsersQuery(next);
      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      if (options?.replace) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [pathname, router]
  );

  const updateQuery = useCallback(
    (
      partial: Partial<AdminUsersQuery>,
      options?: { resetPage?: boolean; replace?: boolean }
    ) => {
      const resetPage = options?.resetPage ?? true;
      const next: AdminUsersQuery = {
        ...query,
        ...partial,
        page: resetPage ? 1 : partial.page ?? query.page,
      };
      setSelectedUser(null);
      applyQuery(next, { replace: options?.replace });
    },
    [applyQuery, query]
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleClearFilters = () => {
    setSelectedUser(null);
    applyQuery({ ...DEFAULT_ADMIN_USERS_QUERY, pageSize: query.pageSize });
  };

  const handleSearchChange = (value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      if ((query.q ?? "") === value) return;
      updateQuery(
        { q: value.trim() ? value.trim() : null },
        { resetPage: true, replace: true }
      );
    }, 350);
  };

  const pageStart = totalCount === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const pageEnd = Math.min(totalCount, query.page * query.pageSize);

  const pendingActive = query.status === "pending";

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-20 -mx-4 border-b border-slate-200/70 bg-white/95 px-4 py-4 backdrop-blur sm:top-16">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">
                User management
              </h1>
              <p className="text-sm text-slate-500">
                Search, filter, and update users without leaving the list.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Link
                href="/admin"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Back to Admin
              </Link>
              <Link
                href="/proxy/auth?path=/admin/users"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Proxy check
              </Link>
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    updateQuery({ status: pendingActive ? "all" : "pending" })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    pendingActive
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:border-amber-200 hover:text-amber-700"
                  )}
                  data-testid="admin-users-pending-filter"
                >
                  Pending requests ({pendingCount})
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col text-xs font-semibold text-slate-500">
              Search
              <Input
                key={`search-${query.q ?? "all"}`}
                defaultValue={query.q ?? ""}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search by email, name, or user ID"
                className="mt-1"
                data-testid="admin-users-search"
              />
            </label>
            <label className="flex min-w-[140px] flex-col text-xs font-semibold text-slate-500">
              Role
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={query.role}
                onChange={(event) =>
                  updateQuery({ role: event.target.value as AdminUsersQuery["role"] })
                }
                data-testid="admin-users-role-filter"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="landlord">Host / Landlord</option>
                <option value="agent">Agent</option>
                <option value="tenant">Tenant</option>
              </select>
            </label>
            <label className="flex min-w-[140px] flex-col text-xs font-semibold text-slate-500">
              Status
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={query.status}
                onChange={(event) =>
                  updateQuery({
                    status: event.target.value as AdminUsersQuery["status"],
                  })
                }
                data-testid="admin-users-status-filter"
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="incomplete">Incomplete</option>
                <option value="missing">Profile missing</option>
              </select>
            </label>
            <label className="flex min-w-[140px] flex-col text-xs font-semibold text-slate-500">
              Plan
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={query.plan}
                onChange={(event) =>
                  updateQuery({ plan: event.target.value as AdminUsersQuery["plan"] })
                }
                data-testid="admin-users-plan-filter"
              >
                <option value="all">All plans</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="tenant_pro">Tenant Pro</option>
              </select>
            </label>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={handleClearFilters}
              className="h-10"
              data-testid="admin-users-clear-filters"
            >
              Clear filters
            </Button>
          </div>

          {!serviceReady && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Add SUPABASE_SERVICE_ROLE_KEY to enable admin user actions.
            </div>
          )}
          {showOnboardingBanner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Finish onboarding to enable admin actions. You can still view users in read-only
              mode.
            </div>
          )}
          {truncated && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Results may be incomplete for very large user sets. Refine filters to narrow results.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          <p>
            {totalCount === 0
              ? "No users match the current filters."
              : `Showing ${pageStart}–${pageEnd} of ${totalCount} users`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() =>
                updateQuery({ page: Math.max(1, query.page - 1) }, { resetPage: false })
              }
              disabled={query.page <= 1}
            >
              Previous
            </Button>
            <span className="text-xs text-slate-500">
              Page {query.page} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() =>
                updateQuery(
                  { page: Math.min(pageCount, query.page + 1) },
                  { resetPage: false }
                )
              }
              disabled={query.page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>

        <div className="hidden border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_80px]">
          <div>User</div>
          <div>Role</div>
          <div>Status</div>
          <div>Plan</div>
          <div>Activity</div>
          <div className="text-right">Open</div>
        </div>

        <div data-testid="admin-users-table">
          {users.map((user, index) => {
            const status = getAdminUserStatus(user);
            const normalizedPlan = normalizePlanTier(user.planTier ?? null);
            const planLabel = planLabelMap[normalizedPlan];
            const normalizedRole = normalizeRole(user.role ?? null);
            const roleLabel = normalizedRole ? formatRoleLabel(user.role) : "—";
            const statusLabel = statusLabelMap[status];
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUser(user)}
                className={cn(
                  "grid w-full grid-cols-1 gap-3 border-b border-slate-100 px-4 py-4 text-left text-sm transition hover:bg-slate-50/70 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_80px]",
                  index % 2 === 1 && "bg-slate-50/30"
                )}
                data-testid="admin-user-row"
                data-user-id={user.id}
                data-email={user.email ?? ""}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {user.email || "No email"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {user.fullName || "No name"} • {user.id.slice(0, 8)}…
                  </p>
                </div>
                <div>
                  <AdminUserBadge
                    label={roleLabel}
                    tone={roleToneMap[normalizedRole ?? ""] || "slate"}
                  />
                </div>
                <div>
                  <AdminUserBadge
                    label={statusLabel}
                    tone={statusToneMap[status]}
                  />
                </div>
                <div>
                  <AdminUserBadge label={planLabel} tone="sky" />
                </div>
                <div className="text-xs text-slate-500">
                  <p>Created {formatDateTime(user.createdAt)}</p>
                  <p>Last sign-in {formatDateTime(user.lastSignInAt)}</p>
                </div>
                <div className="text-right text-xs font-semibold text-slate-500">
                  Manage
                </div>
              </button>
            );
          })}
          {users.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-600">
              No users found. Try adjusting your filters.
            </div>
          )}
        </div>
      </div>

      <AdminUserDrawer
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        serviceReady={serviceReady}
        actionsDisabled={actionsDisabled}
      />
    </div>
  );
}
