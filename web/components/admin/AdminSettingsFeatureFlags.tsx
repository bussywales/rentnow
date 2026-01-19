"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  initialEnabled: boolean;
  updatedAt: string | null;
};

export default function AdminSettingsFeatureFlags({ initialEnabled, updatedAt }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(updatedAt);

  const toggle = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "show_tenant_photo_trust_signals",
          value: { enabled: next },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not update setting");
        return;
      }
      setEnabled(next);
      setSavedAt(data?.setting?.updated_at ?? new Date().toISOString());
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Feature flags</h2>
          <p className="text-sm text-slate-600">
            Tenant photo details — shows non-sensitive photo metadata (no GPS) on property pages
            for tenants.
          </p>
          {savedAt && (
            <p className="text-xs text-slate-500">
              Last updated {new Date(savedAt).toLocaleString()}
            </p>
          )}
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <Button
            size="sm"
            variant={enabled ? "secondary" : "primary"}
            disabled={pending}
            onClick={() => toggle(!enabled)}
          >
            {pending ? "Saving..." : enabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>
    </div>
  );
}
