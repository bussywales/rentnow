"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  flags: {
    enable_location_picker: boolean;
    require_location_pin_for_publish: boolean;
    show_tenant_checkin_badge?: boolean;
  };
  env: {
    mapboxServerConfigured: boolean;
    mapboxClientConfigured: boolean;
  };
};

export function AdminLocationConfigStatus({ flags, env }: Props) {
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runTest = () => {
    setTestStatus(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/geocode?q=Lagos");
        const data = await res.json().catch(() => ({}));
        if (res.status === 501 && data?.code === "MAPBOX_NOT_CONFIGURED") {
          setTestStatus("Not configured (MAPBOX_TOKEN missing)");
          return;
        }
        if (!res.ok) {
          setTestStatus("Geocode failed");
          return;
        }
        setTestStatus("Geocode OK");
      } catch {
        setTestStatus("Geocode failed");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Location configuration</h2>
          <p className="text-sm text-slate-600">
            Flags and Mapbox token presence. Tokens are never shown—only whether they are configured.
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={pending} onClick={runTest}>
          {pending ? "Testing..." : "Test geocode"}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 rounded-xl border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-900">Feature flags</p>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>
              enable_location_picker: {flags.enable_location_picker ? "Enabled" : "Disabled"}
            </li>
            <li>
              require_location_pin_for_publish:{" "}
              {flags.require_location_pin_for_publish ? "Enabled" : "Disabled"}
            </li>
            {typeof flags.show_tenant_checkin_badge !== "undefined" && (
              <li>
                show_tenant_checkin_badge:{" "}
                {flags.show_tenant_checkin_badge ? "Enabled" : "Disabled"}
              </li>
            )}
          </ul>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-900">Tokens</p>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>
              MAPBOX_TOKEN: {env.mapboxServerConfigured ? "Configured" : "Missing"}
            </li>
            <li>
              NEXT_PUBLIC_MAPBOX_TOKEN:{" "}
              {env.mapboxClientConfigured ? "Configured" : "Missing"}
            </li>
          </ul>
          {testStatus && (
            <p
              className={`text-xs ${
                testStatus.startsWith("Geocode OK") ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {testStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
