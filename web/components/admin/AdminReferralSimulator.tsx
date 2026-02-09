"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type Props = {
  maxDepth: number;
  enabledLevels: number[];
  rewardRules: Record<number, { type: string; amount: number }>;
};

type RewardRuleForm = {
  type: "listing_credit" | "featured_credit" | "discount";
  amount: number;
};

const LEVELS = [1, 2, 3, 4, 5] as const;
const LEVEL_FACTORS: Record<number, number> = {
  1: 1,
  2: 0.6,
  3: 0.35,
  4: 0.2,
  5: 0.1,
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function clampDepth(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(5, Math.trunc(value)));
}

function normalizeLevels(levels: number[], maxDepth: number): number[] {
  const cleaned = Array.from(
    new Set(
      levels
        .map((level) => Number(level))
        .filter((level) => Number.isFinite(level))
        .map((level) => Math.trunc(level))
        .filter((level) => level >= 1 && level <= maxDepth)
    )
  ).sort((a, b) => a - b);
  if (!cleaned.includes(1)) cleaned.unshift(1);
  return cleaned;
}

function toRuleType(input: string): RewardRuleForm["type"] {
  if (input === "featured_credit") return "featured_credit";
  if (input === "discount") return "discount";
  return "listing_credit";
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AdminReferralSimulator(props: Props) {
  const initialDepth = clampDepth(props.maxDepth || 1);
  const [referralsPerMonth, setReferralsPerMonth] = useState(120);
  const [listingConversionPercent, setListingConversionPercent] = useState(30);
  const [avgPaidListingsPerActiveUser, setAvgPaidListingsPerActiveUser] = useState(1.5);
  const [subscriptionConversionPercent, setSubscriptionConversionPercent] = useState(12);
  const [depthEnabled, setDepthEnabled] = useState(initialDepth);
  const [enabledLevels, setEnabledLevels] = useState<number[]>(
    normalizeLevels(props.enabledLevels, initialDepth)
  );
  const [rewardByLevel, setRewardByLevel] = useState<Record<number, RewardRuleForm>>(() => {
    const byLevel: Record<number, RewardRuleForm> = {
      1: { type: "listing_credit", amount: 0 },
      2: { type: "listing_credit", amount: 0 },
      3: { type: "listing_credit", amount: 0 },
      4: { type: "listing_credit", amount: 0 },
      5: { type: "listing_credit", amount: 0 },
    };
    for (const level of LEVELS) {
      const rule = props.rewardRules[level];
      byLevel[level] = {
        type: toRuleType(rule?.type || "listing_credit"),
        amount: Number.isFinite(rule?.amount) ? Number(rule.amount) : 0,
      };
    }
    return byLevel;
  });

  const model = useMemo(() => {
    const monthlyReferrals = Math.max(0, referralsPerMonth);
    const listingUsers = monthlyReferrals * (clampPercent(listingConversionPercent) / 100);
    const listingEvents = listingUsers * Math.max(0, avgPaidListingsPerActiveUser);
    const subscriptionEvents = monthlyReferrals * (clampPercent(subscriptionConversionPercent) / 100);
    const qualifyingEvents = listingEvents + subscriptionEvents;

    const perLevel = LEVELS.filter((level) => level <= depthEnabled).map((level) => {
      const enabled = enabledLevels.includes(level);
      const factor = LEVEL_FACTORS[level];
      const projectedRewards = enabled ? qualifyingEvents * factor : 0;
      const rewardAmount = Math.max(0, rewardByLevel[level].amount);
      const projectedCost = projectedRewards * rewardAmount;
      return {
        level,
        enabled,
        factor,
        rewardType: rewardByLevel[level].type,
        rewardAmount,
        projectedRewards,
        projectedCost,
      };
    });

    const monthlyCost = perLevel.reduce((sum, row) => sum + row.projectedCost, 0);
    const costPerQualifiedEvent = qualifyingEvents > 0 ? monthlyCost / qualifyingEvents : 0;

    return {
      monthlyReferrals,
      listingUsers,
      listingEvents,
      subscriptionEvents,
      qualifyingEvents,
      perLevel,
      monthlyCost,
      costPerQualifiedEvent,
    };
  }, [
    avgPaidListingsPerActiveUser,
    depthEnabled,
    enabledLevels,
    listingConversionPercent,
    referralsPerMonth,
    rewardByLevel,
    subscriptionConversionPercent,
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Referral simulator</h1>
        <p className="text-sm text-slate-600">
          Directional model for monthly reward cost planning. This simulator does not write to the database.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Referrals per month</label>
            <Input
              type="number"
              min={0}
              value={referralsPerMonth}
              onChange={(event) => setReferralsPerMonth(Math.max(0, Number(event.target.value || 0)))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">% conversion to paid listing</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={listingConversionPercent}
              onChange={(event) =>
                setListingConversionPercent(clampPercent(Number(event.target.value || 0)))
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">
              Avg paid listings per active user
            </label>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={avgPaidListingsPerActiveUser}
              onChange={(event) =>
                setAvgPaidListingsPerActiveUser(Math.max(0, Number(event.target.value || 0)))
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Subscription conversion %</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={subscriptionConversionPercent}
              onChange={(event) =>
                setSubscriptionConversionPercent(clampPercent(Number(event.target.value || 0)))
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Depth enabled</label>
            <Select
              value={String(depthEnabled)}
              onChange={(event) => {
                const nextDepth = clampDepth(Number(event.target.value));
                setDepthEnabled(nextDepth);
                setEnabledLevels((current) => normalizeLevels(current, nextDepth));
              }}
              className="mt-1"
            >
              {LEVELS.map((level) => (
                <option key={level} value={String(level)}>
                  Level {level}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Rewarded levels</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEVELS.filter((level) => level <= depthEnabled).map((level) => {
                const checked = enabledLevels.includes(level);
                return (
                  <label
                    key={level}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                      checked
                        ? "border-sky-200 bg-sky-50 text-sky-900"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={level === 1}
                      onChange={(event) =>
                        setEnabledLevels((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(level);
                          else next.delete(level);
                          return normalizeLevels(Array.from(next), depthEnabled);
                        })
                      }
                    />
                    L{level}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Reward Overrides</h2>
        <p className="text-sm text-slate-600">Defaults come from current referral settings. Changes here are simulation-only.</p>
        <div className="mt-4 space-y-3">
          {LEVELS.filter((level) => level <= depthEnabled).map((level) => (
            <div
              key={level}
              className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[120px_1fr_1fr]"
            >
              <p className="self-center text-sm font-semibold text-slate-900">Level {level}</p>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-500">Type</label>
                <Select
                  value={rewardByLevel[level].type}
                  onChange={(event) =>
                    setRewardByLevel((current) => ({
                      ...current,
                      [level]: {
                        ...current[level],
                        type: toRuleType(event.target.value),
                      },
                    }))
                  }
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
                  value={rewardByLevel[level].amount}
                  onChange={(event) =>
                    setRewardByLevel((current) => ({
                      ...current,
                      [level]: {
                        ...current[level],
                        amount: Math.max(0, Number(event.target.value || 0)),
                      },
                    }))
                  }
                  className="mt-1"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Projected listing events</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(model.listingEvents)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Projected subscription events</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(model.subscriptionEvents)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Qualified paid events</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(model.qualifyingEvents)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Estimated monthly reward cost</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(model.monthlyCost)}</p>
          <p className="text-xs text-slate-600">Credits / discount units (estimated)</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Projected Rewards Issued Per Level</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Coverage factor</th>
                <th className="px-3 py-2">Projected rewards</th>
                <th className="px-3 py-2">Reward amount</th>
                <th className="px-3 py-2">Projected cost</th>
              </tr>
            </thead>
            <tbody>
              {model.perLevel.map((row) => (
                <tr key={row.level} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-900">Level {row.level}</td>
                  <td className="px-3 py-2 text-slate-700">{row.enabled ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-slate-700">{formatNumber(row.factor * 100)}%</td>
                  <td className="px-3 py-2 text-slate-700">{formatNumber(row.projectedRewards)}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {formatNumber(row.rewardAmount)} ({row.rewardType.replace(/_/g, " ")})
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{formatNumber(row.projectedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Net Impact (Assumption-Based)</h2>
        <p className="mt-2 text-sm text-slate-700">
          Estimated net impact is <span className="font-semibold">-{formatNumber(model.monthlyCost)}</span> reward units per month.
          Average reward cost per qualified paid event is{" "}
          <span className="font-semibold">{formatNumber(model.costPerQualifiedEvent)}</span>.
        </p>
        <p className="mt-3 text-xs text-slate-600">
          Assumptions: level coverage factors decrease with depth (L1 100%, L2 60%, L3 35%, L4 20%, L5 10%);
          this is a planning tool and does not model revenue or guarantee outcomes.
        </p>
      </section>
    </div>
  );
}
