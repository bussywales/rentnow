"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CountrySelect } from "@/components/properties/CountrySelect";
import { CurrencySelect } from "@/components/properties/CurrencySelect";
import {
  calculateCashoutAmountMajorFromPercent,
  calculateCashoutPercentFromAmountMajor,
  majorCurrencyToMinor,
  minorCurrencyToMajor,
  type ReferralCashoutEligibleSource,
  type ReferralCashoutRateMode,
} from "@/lib/referrals/cashout";
import {
  findIsoCountryByCode,
  formatIsoCountryLabel,
  getCommonCurrencyForCountry,
} from "@/lib/iso/countries";
import {
  normalizeJurisdictionPolicyCodes,
  validateJurisdictionPolicyCodes,
  type JurisdictionPolicyCodeErrors,
} from "@/lib/referrals/jurisdiction-policy-validation";

type Policy = {
  id: string;
  country_code: string;
  payouts_enabled: boolean;
  conversion_enabled: boolean;
  credit_to_cash_rate: number;
  cashout_rate_mode: ReferralCashoutRateMode;
  cashout_rate_amount_minor: number | null;
  cashout_rate_percent: number | null;
  cashout_eligible_sources: ReferralCashoutEligibleSource[];
  currency: string;
  min_cashout_credits: number;
  monthly_cashout_cap_amount: number;
  requires_manual_approval: boolean;
  updated_at: string;
};

type Props = {
  initialPolicies: Policy[];
  paygListingFeeAmount: number;
};

type EditablePolicy = Omit<Policy, "updated_at">;

function hasValidationIssues(errors: JurisdictionPolicyCodeErrors): boolean {
  return Boolean(errors.country_code || errors.currency);
}

const ELIGIBLE_SOURCE_OPTIONS: Array<{
  value: ReferralCashoutEligibleSource;
  label: string;
  description: string;
}> = [
  {
    value: "payg_listing_fee_paid",
    label: "PAYG listing fees",
    description: "Credits from paid PAYG listing fees are cashout eligible.",
  },
  {
    value: "featured_purchase_paid",
    label: "Featured purchases",
    description: "Credits from paid featured purchases are cashout eligible.",
  },
  {
    value: "subscription_paid",
    label: "Subscriptions",
    description: "Credits from subscription payments can be made cashout eligible.",
  },
];

function normalizeEligibleSources(
  sources: ReferralCashoutEligibleSource[] | null | undefined
): ReferralCashoutEligibleSource[] {
  if (!Array.isArray(sources)) {
    return ["payg_listing_fee_paid", "featured_purchase_paid"];
  }
  const safe = sources;
  const deduped = Array.from(new Set(safe)).filter((entry): entry is ReferralCashoutEligibleSource =>
    ELIGIBLE_SOURCE_OPTIONS.some((option) => option.value === entry)
  );

  return deduped;
}

function toEditable(policy: Policy): EditablePolicy {
  const normalizedCodes = normalizeJurisdictionPolicyCodes({
    country_code: policy.country_code,
    currency: policy.currency,
  });
  return {
    id: policy.id,
    country_code: normalizedCodes.country_code,
    payouts_enabled: policy.payouts_enabled,
    conversion_enabled: policy.conversion_enabled,
    credit_to_cash_rate: Number(policy.credit_to_cash_rate || 0),
    cashout_rate_mode: policy.cashout_rate_mode || "fixed",
    cashout_rate_amount_minor: Math.max(0, Math.trunc(Number(policy.cashout_rate_amount_minor || 0))),
    cashout_rate_percent:
      policy.cashout_rate_percent === null || policy.cashout_rate_percent === undefined
        ? 0
        : Math.max(0, Number(policy.cashout_rate_percent || 0)),
    cashout_eligible_sources: normalizeEligibleSources(policy.cashout_eligible_sources),
    currency: normalizedCodes.currency || "NGN",
    min_cashout_credits: Math.max(0, Math.trunc(Number(policy.min_cashout_credits || 0))),
    monthly_cashout_cap_amount: Math.max(0, Number(policy.monthly_cashout_cap_amount || 0)),
    requires_manual_approval: policy.requires_manual_approval,
  };
}

function formatCurrency(value: number, currency: string): string {
  const amount = Math.max(0, Number(value || 0));
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

function withPercentApplied(
  draft: EditablePolicy,
  percent: number,
  paygListingFeeAmount: number
): EditablePolicy {
  const safePercent = Math.max(0, Number(percent || 0));
  const nextAmountMajor =
    paygListingFeeAmount > 0
      ? calculateCashoutAmountMajorFromPercent({
          paygListingFeeAmount,
          percent: safePercent,
        })
      : minorCurrencyToMajor(draft.cashout_rate_amount_minor);

  const nextAmountMinor =
    paygListingFeeAmount > 0
      ? majorCurrencyToMinor(nextAmountMajor)
      : Math.max(0, Math.trunc(Number(draft.cashout_rate_amount_minor || 0)));

  return {
    ...draft,
    cashout_rate_percent: safePercent,
    cashout_rate_amount_minor: nextAmountMinor,
    credit_to_cash_rate: minorCurrencyToMajor(nextAmountMinor),
  };
}

function withAmountApplied(
  draft: EditablePolicy,
  amountMajor: number,
  paygListingFeeAmount: number
): EditablePolicy {
  const safeAmountMajor = Math.max(0, Number(amountMajor || 0));
  const nextAmountMinor = majorCurrencyToMinor(safeAmountMajor);
  const nextPercent =
    paygListingFeeAmount > 0
      ? calculateCashoutPercentFromAmountMajor({
          paygListingFeeAmount,
          amountMajor: safeAmountMajor,
        })
      : Math.max(0, Number(draft.cashout_rate_percent || 0));

  return {
    ...draft,
    cashout_rate_amount_minor: nextAmountMinor,
    cashout_rate_percent: nextPercent,
    credit_to_cash_rate: minorCurrencyToMajor(nextAmountMinor),
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

export default function AdminReferralJurisdictions({
  initialPolicies,
  paygListingFeeAmount,
}: Props) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [drafts, setDrafts] = useState<Record<string, EditablePolicy>>(() =>
    Object.fromEntries(initialPolicies.map((policy) => [policy.id, toEditable(policy)]))
  );
  const [createDraft, setCreateDraft] = useState<EditablePolicy>({
    id: "create",
    country_code: "",
    payouts_enabled: false,
    conversion_enabled: false,
    credit_to_cash_rate: 0,
    cashout_rate_mode: "fixed",
    cashout_rate_amount_minor: 0,
    cashout_rate_percent: 0,
    cashout_eligible_sources: ["payg_listing_fee_paid", "featured_purchase_paid"],
    currency: "NGN",
    min_cashout_credits: 0,
    monthly_cashout_cap_amount: 0,
    requires_manual_approval: true,
  });
  const [createFieldErrors, setCreateFieldErrors] = useState<JurisdictionPolicyCodeErrors>({});
  const [draftFieldErrors, setDraftFieldErrors] = useState<
    Record<string, JurisdictionPolicyCodeErrors>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sortedPolicies = useMemo(
    () => [...policies].sort((a, b) => a.country_code.localeCompare(b.country_code)),
    [policies]
  );

  const hasPaygAnchor = paygListingFeeAmount > 0;

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
    if ("country_code" in patch || "currency" in patch) {
      setDraftFieldErrors((current) => {
        const prev = current[id] || {};
        const next = { ...prev };
        if ("country_code" in patch) delete next.country_code;
        if ("currency" in patch) delete next.currency;
        return { ...current, [id]: next };
      });
    }
  };

  const toggleSource = (
    sources: ReferralCashoutEligibleSource[],
    source: ReferralCashoutEligibleSource,
    checked: boolean
  ) => {
    const next = checked ? [...sources, source] : sources.filter((entry) => entry !== source);
    return normalizeEligibleSources(next);
  };

  const applyCountryWithCurrency = (current: EditablePolicy, countryCode: string): EditablePolicy => {
    const normalizedCodes = normalizeJurisdictionPolicyCodes({
      country_code: countryCode,
      currency: current.currency,
    });
    const commonCurrency = getCommonCurrencyForCountry(normalizedCodes.country_code);
    return {
      ...current,
      country_code: normalizedCodes.country_code,
      currency: commonCurrency ?? normalizedCodes.currency,
    };
  };

  const buildPolicyPayload = (draft: EditablePolicy) => {
    const mode = draft.cashout_rate_mode;
    const normalizedCodes = normalizeJurisdictionPolicyCodes({
      country_code: draft.country_code,
      currency: draft.currency,
    });
    const normalizedWithRate =
      mode === "percent_of_payg"
        ? withPercentApplied(draft, Number(draft.cashout_rate_percent || 0), paygListingFeeAmount)
        : withAmountApplied(
            draft,
            minorCurrencyToMajor(draft.cashout_rate_amount_minor),
            paygListingFeeAmount
          );

    return {
      country_code: normalizedCodes.country_code,
      payouts_enabled: draft.payouts_enabled,
      conversion_enabled: draft.conversion_enabled,
      cashout_rate_mode: mode,
      cashout_rate_amount_minor: Math.max(
        0,
        Math.trunc(Number(normalizedWithRate.cashout_rate_amount_minor || 0))
      ),
      cashout_rate_percent: Math.max(0, Number(normalizedWithRate.cashout_rate_percent || 0)),
      credit_to_cash_rate: Number(normalizedWithRate.credit_to_cash_rate || 0),
      cashout_eligible_sources: normalizeEligibleSources(draft.cashout_eligible_sources),
      currency: normalizedCodes.currency,
      min_cashout_credits: Math.max(0, Math.trunc(Number(draft.min_cashout_credits || 0))),
      monthly_cashout_cap_amount: Math.max(0, Number(draft.monthly_cashout_cap_amount || 0)),
      requires_manual_approval: draft.requires_manual_approval,
    };
  };

  const savePolicy = (id: string) => {
    const draft = drafts[id];
    if (!draft) return;

    const validation = validateJurisdictionPolicyCodes({
      country_code: draft.country_code,
      currency: draft.currency,
    });
    setDraftFieldErrors((current) => ({ ...current, [id]: validation }));
    if (hasValidationIssues(validation)) return;

    setError(null);
    setToast(null);

    startTransition(async () => {
      try {
        const result = await jsonRequest(`/api/admin/referrals/policies/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(buildPolicyPayload(draft)),
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
    const validation = validateJurisdictionPolicyCodes({
      country_code: createDraft.country_code,
      currency: createDraft.currency,
    });
    setCreateFieldErrors(validation);
    if (hasValidationIssues(validation)) return;

    setError(null);
    setToast(null);

    startTransition(async () => {
      try {
        const result = await jsonRequest("/api/admin/referrals/policies", {
          method: "POST",
          body: JSON.stringify(buildPolicyPayload(createDraft)),
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
          id: "create",
          country_code: "",
          payouts_enabled: false,
          conversion_enabled: false,
          credit_to_cash_rate: 0,
          cashout_rate_mode: "fixed",
          cashout_rate_amount_minor: 0,
          cashout_rate_percent: 0,
          cashout_eligible_sources: ["payg_listing_fee_paid", "featured_purchase_paid"],
          currency: "NGN",
          min_cashout_credits: 0,
          monthly_cashout_cap_amount: 0,
          requires_manual_approval: true,
        });
        setCreateFieldErrors({});
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

  const renderRatePreview = (draft: EditablePolicy) => {
    if (!hasPaygAnchor) {
      return (
        <p className="text-xs text-amber-700">
          Set PAYG listing fee to use percent mode.
        </p>
      );
    }

    const percent = Math.max(0, Number(draft.cashout_rate_percent || 0));
    const amountMajor = calculateCashoutAmountMajorFromPercent({
      paygListingFeeAmount,
      percent,
    });

    return (
      <p className="text-xs text-slate-600">
        PAYG listing fee (current):{" "}
        <span className="font-semibold">
          {formatCurrency(paygListingFeeAmount, draft.currency)}
        </span>
        . At <span className="font-semibold">{percent.toFixed(4).replace(/\.?0+$/, "")}%</span> ={" "}
        <span className="font-semibold">{formatCurrency(amountMajor, draft.currency)}</span> per credit.
      </p>
    );
  };

  const renderRateSection = (
    draft: EditablePolicy,
    onChange: (nextDraft: EditablePolicy) => void,
    testIdPrefix: string
  ) => {
    const amountMajor = minorCurrencyToMajor(draft.cashout_rate_amount_minor);

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-900">Cashout rate</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={draft.cashout_rate_mode === "fixed"}
              onChange={() => onChange({ ...draft, cashout_rate_mode: "fixed" })}
              data-testid={`${testIdPrefix}-rate-mode-fixed`}
            />
            Fixed amount per credit
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={draft.cashout_rate_mode === "percent_of_payg"}
              onChange={() => onChange({ ...draft, cashout_rate_mode: "percent_of_payg" })}
              data-testid={`${testIdPrefix}-rate-mode-percent`}
            />
            % of PAYG listing fee
          </label>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>% of PAYG listing fee</span>
            <Input
              type="number"
              min={0}
              step="0.0001"
              value={Number(draft.cashout_rate_percent || 0)}
              onChange={(event) =>
                onChange(
                  withPercentApplied(
                    draft,
                    Math.max(0, Number(event.target.value || 0)),
                    paygListingFeeAmount
                  )
                )
              }
              disabled={draft.cashout_rate_mode !== "percent_of_payg"}
              data-testid={`${testIdPrefix}-rate-percent`}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Amount per credit ({draft.currency || "NGN"})</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={Number(amountMajor.toFixed(2))}
              onChange={(event) =>
                onChange(
                  withAmountApplied(
                    draft,
                    Math.max(0, Number(event.target.value || 0)),
                    paygListingFeeAmount
                  )
                )
              }
              disabled={draft.cashout_rate_mode !== "fixed"}
              data-testid={`${testIdPrefix}-rate-amount`}
            />
          </label>
        </div>

        <div className="mt-2">{renderRatePreview(draft)}</div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Jurisdictions</h2>
          <p className="text-sm text-slate-600">
            Configure cashout eligibility, conversion mode, and approval controls by country.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Add or upsert jurisdiction policy</p>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>Country (ISO 3166-1 alpha-2)</span>
            <CountrySelect
              id="jurisdiction-create-country-select"
              value={
                findIsoCountryByCode(createDraft.country_code) || createDraft.country_code
                  ? {
                      code: createDraft.country_code,
                      name: findIsoCountryByCode(createDraft.country_code)?.name ?? createDraft.country_code,
                    }
                  : null
              }
              onChange={(selected) => {
                setCreateDraft((current) => applyCountryWithCurrency(current, selected.code));
                setCreateFieldErrors((current) => ({
                  ...current,
                  country_code: undefined,
                  currency: undefined,
                }));
              }}
              placeholder="Search countries"
              disabled={pending}
            />
            <input type="hidden" value={createDraft.country_code} data-testid="jurisdiction-create-country-code" readOnly />
            {createFieldErrors.country_code ? (
              <p className="text-xs text-rose-600">{createFieldErrors.country_code}</p>
            ) : null}
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Currency (ISO 4217)</span>
            <CurrencySelect
              id="jurisdiction-create-currency-select"
              value={createDraft.currency}
              onChange={(value) => {
                setCreateDraft((current) => ({
                  ...current,
                  currency: String(value || "").trim().toUpperCase(),
                }));
                setCreateFieldErrors((current) => ({ ...current, currency: undefined }));
              }}
              placeholder="Search currencies"
              disabled={pending}
            />
            {createFieldErrors.currency ? (
              <p className="text-xs text-rose-600">{createFieldErrors.currency}</p>
            ) : null}
          </label>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createDraft.payouts_enabled}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, payouts_enabled: event.target.checked }))
              }
            />
            Cashout enabled
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
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">Eligible reward sources</p>
          <p className="mt-1 text-xs text-slate-600">
            We recommend leaving subscriptions OFF to avoid arbitrage.
          </p>
          <div className="mt-2 grid gap-2">
            {ELIGIBLE_SOURCE_OPTIONS.map((source) => {
              const checked = createDraft.cashout_eligible_sources.includes(source.value);
              return (
                <label key={source.value} className="inline-flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setCreateDraft((current) => ({
                        ...current,
                        cashout_eligible_sources: toggleSource(
                          current.cashout_eligible_sources,
                          source.value,
                          event.target.checked
                        ),
                      }))
                    }
                    data-testid={`jurisdiction-create-source-${source.value}`}
                  />
                  <span>
                    <span className="font-medium text-slate-900">{source.label}</span>
                    <span className="block text-xs text-slate-600">{source.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          {renderRateSection(
            createDraft,
            (next) => setCreateDraft(next),
            "jurisdiction-create"
          )}
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">Minimums & caps</p>
          <p className="mt-1 text-xs text-slate-600">
            Use these controls to limit small withdrawals and cap monthly payout exposure.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Minimum credits to cash out</span>
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
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Monthly cashout cap (cash amount)</span>
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
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Lifetime cashout cap (credits)</span>
              <Input value="" placeholder="Not configured in schema" disabled />
            </label>
          </div>
        </div>

        <div className="mt-3">
          <Button
            type="button"
            onClick={createPolicy}
            disabled={pending || !createDraft.country_code.trim() || !createDraft.currency.trim()}
            data-testid="jurisdiction-create-save"
          >
            {pending ? "Saving..." : "Save jurisdiction"}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sortedPolicies.length ? (
          sortedPolicies.map((policy) => {
            const draft = drafts[policy.id] || toEditable(policy);
            const countryOption = findIsoCountryByCode(draft.country_code);
            const countryLabel = countryOption
              ? formatIsoCountryLabel(countryOption)
              : draft.country_code || policy.country_code;

            return (
              <div
                key={policy.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
                data-testid={`jurisdiction-policy-card-${policy.country_code}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {countryLabel} policy
                  </p>
                  <div className="flex items-center gap-2">
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

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Country (ISO 3166-1 alpha-2)</span>
                    <CountrySelect
                      id={`jurisdiction-${policy.id}-country-select`}
                      value={
                        findIsoCountryByCode(draft.country_code) || draft.country_code
                          ? {
                              code: draft.country_code,
                              name:
                                findIsoCountryByCode(draft.country_code)?.name ??
                                draft.country_code,
                            }
                          : null
                      }
                      onChange={(selected) =>
                        setDraft(policy.id, applyCountryWithCurrency(draft, selected.code))
                      }
                      placeholder="Search countries"
                      disabled={pending}
                    />
                    {draftFieldErrors[policy.id]?.country_code ? (
                      <p className="text-xs text-rose-600">
                        {draftFieldErrors[policy.id]?.country_code}
                      </p>
                    ) : null}
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Currency (ISO 4217)</span>
                    <CurrencySelect
                      id={`jurisdiction-${policy.id}-currency-select`}
                      value={draft.currency}
                      onChange={(value) =>
                        setDraft(policy.id, {
                          currency: String(value || "").trim().toUpperCase(),
                        })
                      }
                      placeholder="Search currencies"
                      disabled={pending}
                    />
                    {draftFieldErrors[policy.id]?.currency ? (
                      <p className="text-xs text-rose-600">
                        {draftFieldErrors[policy.id]?.currency}
                      </p>
                    ) : null}
                  </label>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.payouts_enabled}
                      onChange={(event) =>
                        setDraft(policy.id, { payouts_enabled: event.target.checked })
                      }
                    />
                    Cashout enabled
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.conversion_enabled}
                      onChange={(event) =>
                        setDraft(policy.id, { conversion_enabled: event.target.checked })
                      }
                    />
                    Conversion enabled
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
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

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Eligible reward sources</p>
                  <p className="mt-1 text-xs text-slate-600">
                    We recommend leaving subscriptions OFF to avoid arbitrage.
                  </p>
                  <div className="mt-2 grid gap-2">
                    {ELIGIBLE_SOURCE_OPTIONS.map((source) => {
                      const checked = draft.cashout_eligible_sources.includes(source.value);
                      return (
                        <label key={source.value} className="inline-flex items-start gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setDraft(policy.id, {
                                cashout_eligible_sources: toggleSource(
                                  draft.cashout_eligible_sources,
                                  source.value,
                                  event.target.checked
                                ),
                              })
                            }
                            data-testid={`jurisdiction-${policy.country_code}-source-${source.value}`}
                          />
                          <span>
                            <span className="font-medium text-slate-900">{source.label}</span>
                            <span className="block text-xs text-slate-600">{source.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3">
                  {renderRateSection(
                    draft,
                    (nextDraft) => setDraft(policy.id, nextDraft),
                    `jurisdiction-${policy.country_code}`
                  )}
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Minimums & caps</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Use these controls to limit small withdrawals and cap monthly payout exposure.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <label className="space-y-1 text-sm text-slate-700">
                      <span>Minimum credits to cash out</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={draft.min_cashout_credits}
                        onChange={(event) =>
                          setDraft(policy.id, {
                            min_cashout_credits: Math.max(
                              0,
                              Math.trunc(Number(event.target.value || 0))
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span>Monthly cashout cap (cash amount)</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.monthly_cashout_cap_amount}
                        onChange={(event) =>
                          setDraft(policy.id, {
                            monthly_cashout_cap_amount: Math.max(
                              0,
                              Number(event.target.value || 0)
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span>Lifetime cashout cap (credits)</span>
                      <Input value="" placeholder="Not configured in schema" disabled />
                    </label>
                  </div>
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
