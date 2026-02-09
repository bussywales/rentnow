"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type Policy = {
  id: string;
  country_code: string;
  payouts_enabled: boolean;
  conversion_enabled: boolean;
  credit_to_cash_rate: number;
  currency: string;
  min_cashout_credits: number;
  monthly_cashout_cap_amount: number;
  requires_manual_approval: boolean;
  updated_at: string;
};

type Props = {
  initialPolicies: Policy[];
};

type EditablePolicy = Omit<Policy, "updated_at">;

function toEditable(policy: Policy): EditablePolicy {
  return {
    id: policy.id,
    country_code: policy.country_code,
    payouts_enabled: policy.payouts_enabled,
    conversion_enabled: policy.conversion_enabled,
    credit_to_cash_rate: Number(policy.credit_to_cash_rate || 0),
    currency: policy.currency || "NGN",
    min_cashout_credits: Math.max(0, Math.trunc(Number(policy.min_cashout_credits || 0))),
    monthly_cashout_cap_amount: Math.max(0, Number(policy.monthly_cashout_cap_amount || 0)),
    requires_manual_approval: policy.requires_manual_approval,
  };
}

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Request failed");
  }
  return payload;
}

export default function AdminReferralJurisdictions({ initialPolicies }: Props) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [drafts, setDrafts] = useState<Record<string, EditablePolicy>>(() =>
    Object.fromEntries(initialPolicies.map((policy) => [policy.id, toEditable(policy)]))
  );
  const [createDraft, setCreateDraft] = useState({
    country_code: "",
    payouts_enabled: false,
    conversion_enabled: false,
    credit_to_cash_rate: 0,
    currency: "NGN",
    min_cashout_credits: 0,
    monthly_cashout_cap_amount: 0,
    requires_manual_approval: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sortedPolicies = useMemo(
    () => [...policies].sort((a, b) => a.country_code.localeCompare(b.country_code)),
    [policies]
  );

  const setDraft = (id: string, patch: Partial<EditablePolicy>) => {
    setDrafts((current) => {
      const policy = policies.find((row) => row.id === id);
      if (!policy) return current;
      const base = current[id] || toEditable(policy);
      return {
        ...current,
        [id]: {
          ...base,
          ...patch,
        },
      };
    });
  };

  const savePolicy = (id: string) => {
    const draft = drafts[id];
    if (!draft) return;

    setError(null);
    setToast(null);

    startTransition(async () => {
      try {
        const payload = {
          country_code: draft.country_code.trim().toUpperCase(),
          payouts_enabled: draft.payouts_enabled,
          conversion_enabled: draft.conversion_enabled,
          credit_to_cash_rate: Number(draft.credit_to_cash_rate || 0),
          currency: draft.currency.trim().toUpperCase(),
          min_cashout_credits: Math.max(0, Math.trunc(Number(draft.min_cashout_credits || 0))),
          monthly_cashout_cap_amount: Math.max(0, Number(draft.monthly_cashout_cap_amount || 0)),
          requires_manual_approval: draft.requires_manual_approval,
        };

        const result = await jsonRequest(`/api/admin/referrals/policies/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        const nextPolicy = result.policy as Policy;
        setPolicies((current) => current.map((row) => (row.id === id ? nextPolicy : row)));
        setDrafts((current) => ({
          ...current,
          [id]: toEditable(nextPolicy),
        }));
        setToast(`Saved ${nextPolicy.country_code}.`);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save policy");
      }
    });
  };

  const createPolicy = () => {
    setError(null);
    setToast(null);

    startTransition(async () => {
      try {
        const payload = {
          country_code: createDraft.country_code.trim().toUpperCase(),
          payouts_enabled: createDraft.payouts_enabled,
          conversion_enabled: createDraft.conversion_enabled,
          credit_to_cash_rate: Math.max(0, Number(createDraft.credit_to_cash_rate || 0)),
          currency: createDraft.currency.trim().toUpperCase(),
          min_cashout_credits: Math.max(0, Math.trunc(Number(createDraft.min_cashout_credits || 0))),
          monthly_cashout_cap_amount: Math.max(0, Number(createDraft.monthly_cashout_cap_amount || 0)),
          requires_manual_approval: createDraft.requires_manual_approval,
        };

        const result = await jsonRequest("/api/admin/referrals/policies", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const nextPolicy = result.policy as Policy;
        setPolicies((current) => {
          const withoutCountry = current.filter(
            (policy) => policy.country_code !== nextPolicy.country_code
          );
          return [...withoutCountry, nextPolicy];
        });
        setDrafts((current) => ({
          ...current,
          [nextPolicy.id]: toEditable(nextPolicy),
        }));
        setCreateDraft({
          country_code: "",
          payouts_enabled: false,
          conversion_enabled: false,
          credit_to_cash_rate: 0,
          currency: "NGN",
          min_cashout_credits: 0,
          monthly_cashout_cap_amount: 0,
          requires_manual_approval: true,
        });
        setToast(`Saved ${nextPolicy.country_code}.`);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Unable to create policy");
      }
    });
  };

  const removePolicy = (id: string) => {
    setError(null);
    setToast(null);

    startTransition(async () => {
      try {
        await jsonRequest(`/api/admin/referrals/policies/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        setPolicies((current) => current.filter((policy) => policy.id !== id));
        setDrafts((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setToast("Policy removed.");
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "Unable to remove policy");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Jurisdictions</h2>
          <p className="text-sm text-slate-600">
            Control where referral cashout is enabled and set conversion, minimums, and caps.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Add or upsert jurisdiction policy</p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <Input
            value={createDraft.country_code}
            onChange={(event) =>
              setCreateDraft((current) => ({ ...current, country_code: event.target.value }))
            }
            maxLength={3}
            placeholder="Country code"
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={createDraft.credit_to_cash_rate}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                credit_to_cash_rate: Math.max(0, Number(event.target.value || 0)),
              }))
            }
            placeholder="Rate"
          />
          <Input
            value={createDraft.currency}
            onChange={(event) =>
              setCreateDraft((current) => ({ ...current, currency: event.target.value }))
            }
            maxLength={10}
            placeholder="Currency"
          />
          <Button type="button" onClick={createPolicy} disabled={pending || !createDraft.country_code.trim()}>
            {pending ? "Saving..." : "Save jurisdiction"}
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createDraft.payouts_enabled}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, payouts_enabled: event.target.checked }))
              }
            />
            Payouts enabled
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createDraft.conversion_enabled}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, conversion_enabled: event.target.checked }))
              }
            />
            Conversion enabled
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createDraft.requires_manual_approval}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  requires_manual_approval: event.target.checked,
                }))
              }
            />
            Manual approval required
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={0}
              step={1}
              value={createDraft.min_cashout_credits}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  min_cashout_credits: Math.max(0, Math.trunc(Number(event.target.value || 0))),
                }))
              }
              placeholder="Min credits"
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={createDraft.monthly_cashout_cap_amount}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  monthly_cashout_cap_amount: Math.max(0, Number(event.target.value || 0)),
                }))
              }
              placeholder="Monthly cap"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sortedPolicies.length ? (
          sortedPolicies.map((policy) => {
            const draft = drafts[policy.id] || toEditable(policy);
            return (
              <div key={policy.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid gap-2 md:grid-cols-[120px_120px_110px_110px_1fr_auto] md:items-center">
                  <Input
                    value={draft.country_code}
                    onChange={(event) =>
                      setDraft(policy.id, {
                        country_code: event.target.value.toUpperCase(),
                      })
                    }
                    maxLength={3}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.credit_to_cash_rate}
                    onChange={(event) =>
                      setDraft(policy.id, {
                        credit_to_cash_rate: Math.max(0, Number(event.target.value || 0)),
                      })
                    }
                  />
                  <Input
                    value={draft.currency}
                    onChange={(event) =>
                      setDraft(policy.id, {
                        currency: event.target.value.toUpperCase(),
                      })
                    }
                    maxLength={10}
                  />
                  <Select
                    value={String(draft.min_cashout_credits)}
                    onChange={(event) =>
                      setDraft(policy.id, {
                        min_cashout_credits: Math.max(0, Math.trunc(Number(event.target.value || 0))),
                      })
                    }
                  >
                    {[0, 1, 5, 10, 25, 50, 100].map((value) => (
                      <option key={value} value={String(value)}>
                        Min {value}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.monthly_cashout_cap_amount}
                    onChange={(event) =>
                      setDraft(policy.id, {
                        monthly_cashout_cap_amount: Math.max(0, Number(event.target.value || 0)),
                      })
                    }
                  />
                  <div className="flex items-center gap-2 md:justify-end">
                    <Button type="button" size="sm" onClick={() => savePolicy(policy.id)} disabled={pending}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => removePolicy(policy.id)}
                      disabled={pending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.payouts_enabled}
                      onChange={(event) =>
                        setDraft(policy.id, { payouts_enabled: event.target.checked })
                      }
                    />
                    Payouts enabled
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.conversion_enabled}
                      onChange={(event) =>
                        setDraft(policy.id, { conversion_enabled: event.target.checked })
                      }
                    />
                    Conversion enabled
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.requires_manual_approval}
                      onChange={(event) =>
                        setDraft(policy.id, { requires_manual_approval: event.target.checked })
                      }
                    />
                    Manual approval required
                  </label>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-600">No jurisdiction policies yet.</p>
        )}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {toast}
        </div>
      ) : null}
    </section>
  );
}
