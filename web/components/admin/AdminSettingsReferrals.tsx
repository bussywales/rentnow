"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type AnalyticsPreview = {
  totalReferred: number;
  totalRewardsIssued: number;
  totalCreditsEarned: number;
};

type Props = {
  enabled: boolean;
  maxDepth: number;
  enabledLevels: number[];
  rewardRules: Record<number, { type: string; amount: number }>;
  tierThresholds: Record<string, number>;
  caps: { daily: number; monthly: number };
  analytics: AnalyticsPreview;
};

async function patchSetting(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/app-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to update setting");
  }
  return json;
}

export default function AdminSettingsReferrals(props: Props) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(props.enabled);
  const [maxDepth, setMaxDepth] = useState(props.maxDepth);
  const [levelsText, setLevelsText] = useState(() => JSON.stringify(props.enabledLevels));
  const [rulesText, setRulesText] = useState(() => JSON.stringify(props.rewardRules, null, 2));
  const [tiersText, setTiersText] = useState(() => JSON.stringify(props.tierThresholds, null, 2));
  const [capsText, setCapsText] = useState(() => JSON.stringify(props.caps, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const preview = useMemo(() => props.analytics, [props.analytics]);

  const runUpdate = (action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update referral settings.");
      }
    });
  };

  const saveEnabled = (next: boolean) =>
    runUpdate(async () => {
      await patchSetting({ key: "referrals_enabled", value: { enabled: next } });
      setEnabled(next);
      setToast(next ? "Referral rewards enabled." : "Referral rewards paused.");
    });

  const saveMaxDepth = () =>
    runUpdate(async () => {
      await patchSetting({ key: "referral_max_depth", value: { value: maxDepth } });
      setToast("Max depth updated.");
    });

  const saveJsonSetting = (key: string, raw: string, successMessage: string) =>
    runUpdate(async () => {
      const parsed = JSON.parse(raw);
      await patchSetting({ key, value: { value: parsed } });
      setToast(successMessage);
    });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Referral settings</h1>
        <p className="text-sm text-slate-600">
          Configure multi-level rewards and tier thresholds. Changes apply to future rewards only.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">System status</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{enabled ? "Active" : "Paused"}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => saveEnabled(!enabled)} disabled={pending}>
                {pending ? "Saving..." : enabled ? "Pause rewards" : "Enable rewards"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total referred</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{preview.totalReferred.toLocaleString()}</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Rewards issued</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {preview.totalRewardsIssued.toLocaleString()}
            </p>
            <p className="text-xs text-slate-600">Credits tracked: {preview.totalCreditsEarned.toFixed(2)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Reward controls</h2>
        <p className="text-sm text-slate-600">Set enabled depth (1-5), rewarded levels, and per-level rules.</p>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <label className="text-sm font-semibold text-slate-900" htmlFor="ref-max-depth">
              Enabled referral depth (1-5)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="ref-max-depth"
                type="number"
                min={1}
                max={5}
                value={maxDepth}
                onChange={(event) => setMaxDepth(Number(event.target.value))}
                className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                disabled={pending}
              />
              <Button size="sm" onClick={saveMaxDepth} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Enabled levels (JSON array)</p>
            <textarea
              value={levelsText}
              onChange={(event) => setLevelsText(event.target.value)}
              className="mt-2 h-20 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
              spellCheck={false}
              disabled={pending}
            />
            <div className="mt-2">
              <Button
                size="sm"
                onClick={() =>
                  saveJsonSetting("referral_enabled_levels", levelsText, "Enabled levels updated.")
                }
                disabled={pending}
              >
                {pending ? "Saving..." : "Save levels"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Reward rules (JSON object)</p>
            <textarea
              value={rulesText}
              onChange={(event) => setRulesText(event.target.value)}
              className="mt-2 h-48 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
              spellCheck={false}
              disabled={pending}
            />
            <div className="mt-2">
              <Button
                size="sm"
                onClick={() =>
                  saveJsonSetting("referral_reward_rules", rulesText, "Reward rules updated.")
                }
                disabled={pending}
              >
                {pending ? "Saving..." : "Save rules"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Tiers and caps</h2>
        <p className="text-sm text-slate-600">Define tier thresholds and daily/monthly reward caps.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Tier thresholds (JSON object)</p>
            <textarea
              value={tiersText}
              onChange={(event) => setTiersText(event.target.value)}
              className="mt-2 h-40 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
              spellCheck={false}
              disabled={pending}
            />
            <div className="mt-2">
              <Button
                size="sm"
                onClick={() =>
                  saveJsonSetting("referral_tier_thresholds", tiersText, "Tier thresholds updated.")
                }
                disabled={pending}
              >
                {pending ? "Saving..." : "Save tiers"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Caps (JSON object)</p>
            <textarea
              value={capsText}
              onChange={(event) => setCapsText(event.target.value)}
              className="mt-2 h-40 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
              spellCheck={false}
              disabled={pending}
            />
            <div className="mt-2">
              <Button
                size="sm"
                onClick={() => saveJsonSetting("referral_caps", capsText, "Referral caps updated.")}
                disabled={pending}
              >
                {pending ? "Saving..." : "Save caps"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {toast && <p className="text-sm text-emerald-600">{toast}</p>}
    </div>
  );
}
