"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  DEMO_LISTINGS_VISIBILITY_POLICIES,
  type DemoListingsVisibilityPolicy,
} from "@/lib/properties/demo";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";

type Props = {
  policy: DemoListingsVisibilityPolicy;
  updatedAt: string | null;
};

const POLICY_LABELS: Record<DemoListingsVisibilityPolicy, string> = {
  restricted: "Restricted (admin + hosts only)",
  public: "Public (everyone)",
};

export default function AdminSettingsDemoVisibilityPolicy({
  policy,
  updatedAt,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [localPolicy, setLocalPolicy] =
    useState<DemoListingsVisibilityPolicy>(policy);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: APP_SETTING_KEYS.demoListingsVisibilityPolicy,
          value: { value: localPolicy },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not update setting");
        return;
      }
      setToast("Updated demo listing visibility policy.");
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Demo listing visibility
          </h2>
          <p className="text-sm text-slate-600">
            Choose whether demo listings are public to everyone or restricted to
            admin/host roles.
          </p>
          {updatedAt ? (
            <p className="text-xs text-slate-500">
              Last updated {new Date(updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="demo-listings-visibility-policy"
            className="text-xs font-semibold text-slate-500"
          >
            Policy
          </label>
          <select
            id="demo-listings-visibility-policy"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            value={localPolicy}
            onChange={(event) =>
              setLocalPolicy(event.target.value as DemoListingsVisibilityPolicy)
            }
            disabled={pending}
          >
            {DEMO_LISTINGS_VISIBILITY_POLICIES.map((value) => (
              <option key={value} value={value}>
                {POLICY_LABELS[value]}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      {toast ? <p className="mt-2 text-xs text-emerald-600">{toast}</p> : null}
    </div>
  );
}
