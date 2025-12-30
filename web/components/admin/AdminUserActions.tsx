"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  userId: string;
  email?: string;
  serviceReady: boolean;
  planTier?: string | null;
  maxListingsOverride?: number | null;
};

export function AdminUserActions({
  userId,
  email,
  serviceReady,
  planTier,
  maxListingsOverride,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [tier, setTier] = useState(planTier || "free");
  const [override, setOverride] = useState(
    typeof maxListingsOverride === "number" ? String(maxListingsOverride) : ""
  );

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
        <Button size="sm" type="button" onClick={handleReset} disabled={!serviceReady || !email || status === "loading"}>
          {status === "loading" ? "Working..." : "Send reset email"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={handleDelete}
          disabled={!serviceReady || status === "loading"}
        >
          Delete user
        </Button>
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
              disabled={!serviceReady || planStatus === "loading"}
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
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
              disabled={!serviceReady || planStatus === "loading"}
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={updatePlan}
            disabled={!serviceReady || planStatus === "loading"}
          >
            {planStatus === "loading" ? "Saving..." : "Save plan"}
          </Button>
        </div>
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
