"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
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
      setMessage("Reset email sent.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const handleDelete = async () => {
    const ok = confirm("Delete this user? This cannot be undone.");
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
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" onClick={handleReset} disabled={disabled || !email || status === "loading"}>
          {status === "loading" ? "Working..." : "Send reset email"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={handleDelete}
          disabled={disabled || status === "loading"}
        >
          Delete user
        </Button>
      </div>
      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Role management</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">
            Role
            <select
              className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
              value={roleValue}
              onChange={(event) => setRoleValue(event.target.value as KnownRole)}
              disabled={disabled || roleStatus === "loading"}
            >
              <option value="" disabled>
                Select role
              </option>
              <option value="tenant">Tenant</option>
              <option value="landlord">Landlord</option>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Reason
            <input
              className="ml-2 w-52 rounded-md border border-slate-300 px-2 py-1 text-xs"
              type="text"
              placeholder="Required"
              value={roleReason}
              onChange={(event) => setRoleReason(event.target.value)}
              disabled={disabled || roleStatus === "loading"}
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={updateRole}
            disabled={disabled || roleStatus === "loading"}
          >
            {roleStatus === "loading" ? "Saving..." : "Save role"}
          </Button>
        </div>
        {roleMessage && <p className="mt-2 text-xs text-slate-600">{roleMessage}</p>}
        {roleStatus === "error" && !roleMessage && (
          <p className="mt-2 text-xs text-rose-600">Role update failed.</p>
        )}
      </div>
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Plan override</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">
            Tier
            <select
              className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
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
          <label className="text-xs text-slate-600">
            Max listings override
            <input
              className="ml-2 w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
              type="number"
              min={1}
              placeholder="—"
              value={override}
              onChange={(event) => setOverride(event.target.value)}
              disabled={disabled || planStatus === "loading"}
            />
          </label>
          <label className="text-xs text-slate-600">
            Valid until
            <input
              className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-xs"
              type="date"
              value={validUntilValue}
              onChange={(event) => setValidUntilValue(event.target.value)}
              disabled={disabled || planStatus === "loading"}
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={updatePlan}
            disabled={disabled || planStatus === "loading"}
          >
            {planStatus === "loading" ? "Saving..." : "Save plan"}
          </Button>
        </div>
        <label className="mt-3 block text-xs text-slate-600">
          Billing notes (admin only)
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={disabled || planStatus === "loading"}
          />
        </label>
        {planMessage && <p className="mt-2 text-xs text-slate-600">{planMessage}</p>}
        {planStatus === "error" && !planMessage && (
          <p className="mt-2 text-xs text-rose-600">Plan update failed.</p>
        )}
      </div>
      {message && <p className="text-xs text-slate-600">{message}</p>}
      {status === "error" && !message && <p className="text-xs text-rose-600">Action failed.</p>}
    </div>
  );
}
