"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { normalizeRole, type KnownRole } from "@/lib/roles";

type Props = {
  userId: string;
  email?: string;
  serviceReady: boolean;
  actionsDisabled?: boolean;
  currentRole?: string | null;
  onboardingCompleted?: boolean | null;
  planTier?: string | null;
  maxListingsOverride?: number | null;
  validUntil?: string | null;
  billingNotes?: string | null;
};

export function AdminUserActions({
  userId,
  email,
  serviceReady,
  actionsDisabled = false,
  currentRole,
  onboardingCompleted,
  planTier,
  maxListingsOverride,
  validUntil,
  billingNotes,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [roleStatus, setRoleStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const normalizedRole = normalizeRole(currentRole);
  const onboardingComplete =
    typeof onboardingCompleted === "boolean" ? onboardingCompleted : null;
  const [roleValue, setRoleValue] = useState<KnownRole | "">(normalizedRole ?? "");
  const [roleReason, setRoleReason] = useState("");
  const [tier, setTier] = useState(planTier || "free");
  const [override, setOverride] = useState(
    typeof maxListingsOverride === "number" ? String(maxListingsOverride) : ""
  );
  const [validUntilValue, setValidUntilValue] = useState(
    typeof validUntil === "string" ? validUntil.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(billingNotes ?? "");
  const disabled = !serviceReady || actionsDisabled;

  const post = async (body: Record<string, string>) => {
    setStatus("loading");
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    setStatus("done");
  };

  const updatePlan = async () => {
    setPlanStatus("loading");
    setPlanMessage(null);
    const overrideValue =
      override.trim().length > 0 ? Number.parseInt(override.trim(), 10) : null;
    if (overrideValue !== null && (!Number.isFinite(overrideValue) || overrideValue <= 0)) {
      setPlanStatus("error");
      setPlanMessage("Override must be a positive number.");
      return;
    }
    const res = await fetch("/api/admin/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: userId,
        planTier: tier,
        maxListingsOverride: overrideValue,
        validUntil: validUntilValue
          ? `${validUntilValue}T23:59:59.999Z`
          : null,
        billingNotes: notes,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPlanStatus("error");
      setPlanMessage(data?.error || `Request failed (${res.status})`);
      return;
    }
    setPlanStatus("done");
    setPlanMessage("Plan updated.");
  };

  const updateRole = async () => {
    setRoleStatus("loading");
    setRoleMessage(null);
    const trimmedReason = roleReason.trim();
    if (!trimmedReason) {
      setRoleStatus("error");
      setRoleMessage("Reason is required.");
      return;
    }
    if (!roleValue) {
      setRoleStatus("error");
      setRoleMessage("Select a role before saving.");
      return;
    }
    if (normalizedRole && normalizedRole === roleValue && onboardingComplete !== false) {
      setRoleStatus("error");
      setRoleMessage("Role is unchanged.");
      return;
    }
    const res = await fetch("/api/admin/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: userId,
        role: roleValue,
        reason: trimmedReason,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRoleStatus("error");
      setRoleMessage(data?.error || `Request failed (${res.status})`);
      return;
    }
    setRoleStatus("done");
    setRoleMessage("Role updated.");
  };

  const handleReset = async () => {
    try {
      await post({ action: "reset_password", userId, email: email || "" });
      setMessage("Password reset sent.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const handleDelete = async () => {
    const ok = confirm("Deactivate/Delete account? This cannot be undone.");
    if (!ok) return;
    try {
      await post({ action: "delete", userId });
      setMessage("User deleted.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">Account actions</p>
          <p className="text-sm text-slate-500">
            Password resets send the Supabase recovery email.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            type="button"
            onClick={handleReset}
            disabled={disabled || !email || status === "loading"}
            data-testid="admin-user-reset"
          >
            {status === "loading" ? "Working..." : "Send password reset"}
          </Button>
        </div>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        {status === "error" && !message && (
          <p className="mt-2 text-sm text-rose-600">Action failed.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">Role management</p>
          <p className="text-sm text-slate-500">Reason is required for role changes.</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-end">
          <label className="text-xs font-semibold text-slate-500">
            Role
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={roleValue}
              onChange={(event) => setRoleValue(event.target.value as KnownRole)}
              disabled={disabled || roleStatus === "loading"}
              data-testid="admin-user-role-select"
            >
              <option value="" disabled>
                Select role
              </option>
              <option value="tenant">Tenant</option>
              <option value="landlord">Host / Landlord</option>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Reason
            <Input
              className="mt-1"
              type="text"
              placeholder="Required"
              value={roleReason}
              onChange={(event) => setRoleReason(event.target.value)}
              disabled={disabled || roleStatus === "loading"}
              data-testid="admin-user-role-reason"
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={updateRole}
            disabled={disabled || roleStatus === "loading"}
            data-testid="admin-user-role-save"
          >
            {roleStatus === "loading" ? "Saving..." : "Save role"}
          </Button>
        </div>
        {roleMessage && (
          <p
            className={`mt-2 text-sm ${
              roleStatus === "error" ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {roleMessage}
          </p>
        )}
        {roleStatus === "error" && !roleMessage && (
          <p className="mt-2 text-sm text-rose-600">Role update failed.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">Plan override</p>
          <p className="text-sm text-slate-500">Adjust billing and plan access when needed.</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">
            Tier
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={tier}
              onChange={(event) => setTier(event.target.value)}
              disabled={disabled || planStatus === "loading"}
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="tenant_pro">Tenant Pro</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Max listings override
            <Input
              className="mt-1"
              type="number"
              min={1}
              placeholder="—"
              value={override}
              onChange={(event) => setOverride(event.target.value)}
              disabled={disabled || planStatus === "loading"}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Valid until
            <Input
              className="mt-1"
              type="date"
              value={validUntilValue}
              onChange={(event) => setValidUntilValue(event.target.value)}
              disabled={disabled || planStatus === "loading"}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Billing notes (admin only)
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={disabled || planStatus === "loading"}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={updatePlan}
            disabled={disabled || planStatus === "loading"}
            data-testid="admin-user-plan-save"
          >
            {planStatus === "loading" ? "Saving..." : "Save plan"}
          </Button>
        </div>
        {planMessage && (
          <p
            className={`mt-2 text-sm ${
              planStatus === "error" ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {planMessage}
          </p>
        )}
        {planStatus === "error" && !planMessage && (
          <p className="mt-2 text-sm text-rose-600">Plan update failed.</p>
        )}
      </div>

      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
        <div>
          <p className="text-sm font-semibold text-rose-900">Danger zone</p>
          <p className="text-sm text-rose-700">
            Deactivate/Delete account removes the user and cannot be undone.
          </p>
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={handleDelete}
            disabled={disabled || status === "loading"}
            className="border-rose-200 text-rose-700 hover:border-rose-300"
            data-testid="admin-user-delete"
          >
            Deactivate/Delete account
          </Button>
        </div>
      </div>
    </div>
  );
}
