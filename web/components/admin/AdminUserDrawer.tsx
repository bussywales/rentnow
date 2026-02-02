"use client";

import { useEffect } from "react";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { AdminUserBadge } from "@/components/admin/AdminUserBadge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { isPlanExpired, normalizePlanTier } from "@/lib/plans";
import { formatRoleLabel, formatRoleStatus } from "@/lib/roles";
import { getAdminUserStatus, type AdminUserRow } from "@/lib/admin/admin-users";

type Props = {
  user: AdminUserRow | null;
  open: boolean;
  onClose: () => void;
  serviceReady: boolean;
  actionsDisabled?: boolean;
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

const planLabelMap: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  tenant_pro: "Tenant Pro",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return value.replace("T", " ").replace("Z", "");
};

export function AdminUserDrawer({
  user,
  open,
  onClose,
  serviceReady,
  actionsDisabled = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!user) return null;

  const status = getAdminUserStatus(user);
  const normalizedPlan = normalizePlanTier(user.planTier ?? null);
  const planLabel = planLabelMap[normalizedPlan];
  const roleLabel = formatRoleLabel(user.role ?? null);
  const roleStatus = formatRoleStatus(user.role ?? null, user.onboardingCompleted);
  const planExpired = isPlanExpired(user.validUntil ?? null);

  return (
    <div
      className={cn(
        "fixed inset-0 z-40",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-slate-900/30 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-label="Close user drawer"
      />
      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-xl translate-x-full border-l border-slate-200 bg-white shadow-2xl transition-transform",
          open && "translate-x-0"
        )}
        data-testid="admin-user-drawer"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">User</p>
              <h2 className="text-lg font-semibold text-slate-900">
                {user.email || "No email"}
              </h2>
              <p className="text-xs text-slate-500">ID {user.id}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AdminUserBadge
                  label={roleStatus}
                  tone={roleToneMap[user.role ?? ""] || "slate"}
                />
                <AdminUserBadge
                  label={statusLabelMap[status]}
                  tone={statusToneMap[status]}
                />
                <AdminUserBadge label={planLabel} tone="sky" />
                {planExpired && <AdminUserBadge label="Expired" tone="rose" />}
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Role</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {roleLabel}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Full name</p>
                  <p className="text-sm text-slate-700">
                    {user.fullName || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Created</p>
                  <p className="text-sm text-slate-700">
                    {formatDateTime(user.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last sign-in</p>
                  <p className="text-sm text-slate-700">
                    {formatDateTime(user.lastSignInAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <AdminUserActions
                userId={user.id}
                email={user.email ?? undefined}
                serviceReady={serviceReady}
                actionsDisabled={actionsDisabled}
                currentRole={user.role ?? null}
                onboardingCompleted={user.onboardingCompleted}
                planTier={user.planTier ?? null}
                maxListingsOverride={user.maxListingsOverride ?? null}
                validUntil={user.validUntil ?? null}
                billingNotes={user.billingNotes ?? null}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
