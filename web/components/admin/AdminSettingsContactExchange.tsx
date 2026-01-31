"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { ContactExchangeMode } from "@/lib/settings/app-settings";

type Props = {
  mode: ContactExchangeMode;
  updatedAt: string | null;
};

const MODE_LABELS: Record<ContactExchangeMode, string> = {
  off: "Off",
  redact: "Redact contact details (recommended)",
  block: "Block contact details",
};

export default function AdminSettingsContactExchange({ mode, updatedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [localMode, setLocalMode] = useState<ContactExchangeMode>(mode);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "contact_exchange_mode", value: { mode: localMode } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not update setting");
        return;
      }
      setToast("Updated contact exchange protection.");
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Contact exchange protection
          </h2>
          <p className="text-sm text-slate-600">
            Controls whether contact details are hidden or blocked in messages.
          </p>
          {updatedAt && (
            <p className="text-xs text-slate-500">
              Last updated {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Mode</label>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            value={localMode}
            onChange={(event) => setLocalMode(event.target.value as ContactExchangeMode)}
            disabled={pending}
          >
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {toast && <p className="mt-2 text-xs text-emerald-600">{toast}</p>}
    </div>
  );
}
