"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

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

type RewardRuleForm = {
  type: "listing_credit" | "featured_credit" | "discount";
  amount: number;
};

type FormState = {
  enabled: boolean;
  maxDepth: number;
  enabledLevels: number[];
  rewardRules: Record<number, RewardRuleForm>;
  tierOrder: string[];
  tierThresholds: Record<string, number>;
  caps: { daily: number; monthly: number };
};

const LEVELS = [1, 2, 3, 4, 5] as const;
const DEFAULT_TIERS = ["Bronze", "Silver", "Gold", "Platinum"];

async function patchSetting(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/app-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || "Unable to update referral setting");
  return json;
}

function clampDepth(value: number): number {
  const next = Number.isFinite(value) ? Math.trunc(value) : 1;
  return Math.max(1, Math.min(5, next));
}

function normalizeEnabledLevels(levels: number[], maxDepth: number): number[] {
  const clean = Array.from(
    new Set(
      levels
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item))
        .map((item) => Math.trunc(item))
        .filter((item) => item >= 1 && item <= maxDepth)
    )
  ).sort((a, b) => a - b);
  if (!clean.includes(1)) clean.unshift(1);
  return clean;
}

function normalizeRewardType(input: string): RewardRuleForm["type"] {
  if (input === "featured_credit") return "featured_credit";
  if (input === "discount") return "discount";
  return "listing_credit";
}

function buildInitialState(props: Props): FormState {
  const maxDepth = clampDepth(props.maxDepth);
  const enabledLevels = normalizeEnabledLevels(props.enabledLevels, maxDepth);
  const rewardRules: Record<number, RewardRuleForm> = {};
  for (const level of LEVELS) {
    const fromProps = props.rewardRules[level];
    rewardRules[level] = {
      type: normalizeRewardType(fromProps?.type || "listing_credit"),
      amount: Number.isFinite(fromProps?.amount) ? Number(fromProps.amount) : 0,
    };
  }

  const tierPairs = Object.entries(props.tierThresholds).map(
    ([name, threshold]) => [name, Number(threshold)] as [string, number]
  );
  const fallbackTierPairs: Array<[string, number]> = DEFAULT_TIERS.map((name, index) => [
    name,
    index * 5,
  ]);
  const sortedTierPairs: Array<[string, number]> = (tierPairs.length ? tierPairs : fallbackTierPairs).sort(
    (a, b) => a[1] - b[1]
  );
  const tierOrder = sortedTierPairs.map(([name]) => name);
  const tierThresholds = Object.fromEntries(
    sortedTierPairs.map(([name, value]) => [name, Math.max(0, Math.trunc(Number(value) || 0))])
  );

  return {
    enabled: props.enabled,
    maxDepth,
    enabledLevels,
    rewardRules,
    tierOrder,
    tierThresholds,
    caps: {
      daily: Math.max(0, Math.trunc(Number(props.caps.daily) || 0)),
      monthly: Math.max(0, Math.trunc(Number(props.caps.monthly) || 0)),
    },
  };
}

function cloneFormState(input: FormState): FormState {
  return {
    enabled: input.enabled,
    maxDepth: input.maxDepth,
    enabledLevels: [...input.enabledLevels],
    rewardRules: Object.fromEntries(
      LEVELS.map((level) => [
        level,
        {
          type: input.rewardRules[level].type,
          amount: input.rewardRules[level].amount,
        },
      ])
    ),
    tierOrder: [...input.tierOrder],
    tierThresholds: Object.fromEntries(
      input.tierOrder.map((name) => [name, input.tierThresholds[name]])
    ),
    caps: { ...input.caps },
  };
}

function validateForm(state: FormState): string[] {
  const issues: string[] = [];

  if (!state.enabledLevels.includes(1)) {
    issues.push("Depth must include level 1.");
  }
  if (state.enabledLevels.some((level) => level > state.maxDepth)) {
    issues.push("Enabled levels cannot exceed max depth.");
  }
  for (const level of state.enabledLevels) {
    const rule = state.rewardRules[level];
    if (!rule || !Number.isFinite(rule.amount) || rule.amount <= 0) {
      issues.push(`Level ${level} reward amount must be greater than 0.`);
    }
  }
  if (state.caps.daily < 0 || state.caps.monthly < 0) {
    issues.push("Daily and monthly caps must be non-negative.");
  }
  if (state.caps.monthly < state.caps.daily) {
    issues.push("Monthly cap must be greater than or equal to daily cap.");
  }

  let lastThreshold = -1;
  for (const tierName of state.tierOrder) {
    const threshold = Math.max(0, Math.trunc(Number(state.tierThresholds[tierName]) || 0));
    if (threshold <= lastThreshold) {
      issues.push("Tier thresholds must be in ascending order.");
      break;
    }
    lastThreshold = threshold;
  }

  return Array.from(new Set(issues));
}

export default function AdminSettingsReferrals(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<FormState>(() => buildInitialState(props));
  const [form, setForm] = useState<FormState>(() => buildInitialState(props));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);

  const warningForDepthCost = form.maxDepth > 2 || form.enabledLevels.some((level) => level > 2);
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [baseline, form]
  );

  const runSave = () => {
    setError(null);
    setToast(null);
    const issues = validateForm(form);
    setValidationIssues(issues);
    if (issues.length > 0) return;

    startTransition(async () => {
      try {
        const enabledLevels = normalizeEnabledLevels(form.enabledLevels, form.maxDepth);
        const rewardRulesPayload = Object.fromEntries(
          enabledLevels.map((level) => [
            String(level),
            {
              type: form.rewardRules[level].type,
              amount: Number(form.rewardRules[level].amount.toFixed(4)),
            },
          ])
        );
        const tierThresholdsPayload = Object.fromEntries(
          form.tierOrder.map((name) => [
            name,
            Math.max(0, Math.trunc(Number(form.tierThresholds[name]) || 0)),
          ])
        );

        await patchSetting({ key: "referrals_enabled", value: { enabled: form.enabled } });
        await patchSetting({ key: "referral_max_depth", value: { value: form.maxDepth } });
        await patchSetting({ key: "referral_enabled_levels", value: { value: enabledLevels } });
        await patchSetting({ key: "referral_reward_rules", value: { value: rewardRulesPayload } });
        await patchSetting({
          key: "referral_tier_thresholds",
          value: { value: tierThresholdsPayload },
        });
        await patchSetting({
          key: "referral_caps",
          value: {
            value: {
              daily: Math.max(0, Math.trunc(form.caps.daily)),
              monthly: Math.max(0, Math.trunc(form.caps.monthly)),
            },
          },
        });

        const synced = cloneFormState({
          ...form,
          enabledLevels,
        });
        setForm(synced);
        setBaseline(synced);
        setToast("Referral settings saved.");
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
      }
    });
  };

  const resetForm = () => {
    setForm(cloneFormState(baseline));
    setValidationIssues([]);
    setError(null);
    setToast("Changes discarded.");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Referral settings</h1>
            <p className="text-sm text-slate-600">
              Rewards are only issued when a referred user completes a verified paid event.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/referrals/simulator"
              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
            >
              Open simulator
            </Link>
            <Link
              href="/admin/referrals/payouts"
              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
            >
              Open payouts queue
            </Link>
            <Link
              href="/help/referrals"
              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
            >
              Referral FAQ
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Program status</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {form.enabled ? "Enabled" : "Paused"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total referred</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {props.analytics.totalReferred.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Rewards issued</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {props.analytics.totalRewardsIssued.toLocaleString()}
            </p>
            <p className="text-xs text-slate-600">
              Credits tracked: {props.analytics.totalCreditsEarned.toFixed(2)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Program</h2>
        <p className="text-sm text-slate-600">Enable or pause future referral rewards.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => setForm((current) => ({ ...current, enabled: !current.enabled }))}
            disabled={pending}
          >
            {form.enabled ? "Pause program" : "Enable program"}
          </Button>
          <span className="text-sm text-slate-600">
            Current: <span className="font-semibold text-slate-900">{form.enabled ? "Enabled" : "Paused"}</span>
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Depth</h2>
        <p className="text-sm text-slate-600">
          Choose max tree depth and which levels are reward-eligible. Higher depth increases cost.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-900" htmlFor="referral-max-depth">
              Max depth
            </label>
            <Select
              id="referral-max-depth"
              value={String(form.maxDepth)}
              onChange={(event) => {
                const nextDepth = clampDepth(Number(event.target.value));
                setForm((current) => {
                  const nextLevels = normalizeEnabledLevels(
                    current.enabledLevels.filter((level) => level <= nextDepth),
                    nextDepth
                  );
                  return {
                    ...current,
                    maxDepth: nextDepth,
                    enabledLevels: nextLevels,
                  };
                });
              }}
              disabled={pending}
              className="mt-2 max-w-[180px]"
            >
              {LEVELS.map((level) => (
                <option key={level} value={String(level)}>
                  {level}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Enabled levels</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEVELS.map((level) => {
                const checked = form.enabledLevels.includes(level);
                const disabled = pending || level > form.maxDepth || level === 1;
                return (
                  <label
                    key={level}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? "border-sky-200 bg-sky-50 text-sky-900"
                        : "border-slate-200 bg-white text-slate-700"
                    } ${level > form.maxDepth ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(event) =>
                        setForm((current) => {
                          if (level > current.maxDepth) return current;
                          const next = new Set(current.enabledLevels);
                          if (event.target.checked) next.add(level);
                          else next.delete(level);
                          return {
                            ...current,
                            enabledLevels: normalizeEnabledLevels(Array.from(next), current.maxDepth),
                          };
                        })
                      }
                    />
                    <span>Level {level}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-600">Level 1 is required.</p>
          </div>
        </div>
        {warningForDepthCost && (
          <p className="mt-3 text-sm text-amber-700">
            Warning: enabling levels beyond 2 can significantly increase reward issuance.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Rewards Per Level</h2>
        <p className="text-sm text-slate-600">
          Rewards are only issued when a referred user completes a verified paid event.
        </p>
        <div className="mt-4 space-y-3">
          {LEVELS.filter((level) => level <= form.maxDepth).map((level) => {
            const isEnabled = form.enabledLevels.includes(level);
            const rule = form.rewardRules[level];
            return (
              <div
                key={level}
                className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[140px_1fr_1fr]"
              >
                <div className="self-center text-sm font-semibold text-slate-900">
                  Level {level}
                  <span className="ml-2 text-xs font-medium text-slate-500">
                    {isEnabled ? "(Enabled)" : "(Disabled)"}
                  </span>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-500">Reward type</label>
                  <Select
                    value={rule.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        rewardRules: {
                          ...current.rewardRules,
                          [level]: {
                            ...current.rewardRules[level],
                            type: normalizeRewardType(event.target.value),
                          },
                        },
                      }))
                    }
                    disabled={pending}
                    className="mt-1"
                  >
                    <option value="listing_credit">Listing credit</option>
                    <option value="featured_credit">Featured credit</option>
                    <option value="discount">Discount</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-500">Amount</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={rule.amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        rewardRules: {
                          ...current.rewardRules,
                          [level]: {
                            ...current.rewardRules[level],
                            amount: Number(event.target.value || 0),
                          },
                        },
                      }))
                    }
                    disabled={pending}
                    className="mt-1"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Tiers</h2>
        <p className="text-sm text-slate-600">Thresholds must be ascending.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {form.tierOrder.map((tierName) => (
            <div key={tierName}>
              <label className="text-xs uppercase tracking-wide text-slate-500">{tierName}</label>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.tierThresholds[tierName]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tierThresholds: {
                      ...current.tierThresholds,
                      [tierName]: Math.max(0, Math.trunc(Number(event.target.value || 0))),
                    },
                  }))
                }
                disabled={pending}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Caps</h2>
        <p className="text-sm text-slate-600">Daily and monthly reward caps must be non-negative.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Daily cap</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.caps.daily}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  caps: {
                    ...current.caps,
                    daily: Math.max(0, Math.trunc(Number(event.target.value || 0))),
                  },
                }))
              }
              disabled={pending}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Monthly cap</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.caps.monthly}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  caps: {
                    ...current.caps,
                    monthly: Math.max(0, Math.trunc(Number(event.target.value || 0))),
                  },
                }))
              }
              disabled={pending}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={runSave} disabled={pending || !isDirty}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={resetForm} disabled={pending || !isDirty}>
          Cancel
        </Button>
      </div>

      {validationIssues.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {validationIssues.join(" ")}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {toast}
        </div>
      )}
    </div>
  );
}
