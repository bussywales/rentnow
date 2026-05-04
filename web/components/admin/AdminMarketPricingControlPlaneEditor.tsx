"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  formatMarketPricingControlPlaneTierLabel,
  formatMarketPricingPolicyStateLabel,
  formatMarketPricingProductLabel,
  formatMarketPricingRoleLabel,
  formatMarketPricingRoleScopeLabel,
  formatMarketPricingTierLabel,
  type MarketBillingPolicyRow,
  type MarketBillingProvider,
  type MarketListingEntitlementRow,
  type MarketOneOffPriceRow,
  type MarketPricingControlPlaneTier,
  type MarketPricingPolicyState,
} from "@/lib/billing/market-pricing";

type Props = {
  policies: MarketBillingPolicyRow[];
  oneOffPrices: MarketOneOffPriceRow[];
  entitlements: MarketListingEntitlementRow[];
};

type PolicyDraft = {
  policy_state: MarketPricingPolicyState;
  rental_enabled: boolean;
  sale_enabled: boolean;
  shortlet_enabled: boolean;
  payg_listing_enabled: boolean;
  featured_listing_enabled: boolean;
  subscription_checkout_enabled: boolean;
  listing_payg_provider: MarketBillingProvider | "";
  featured_listing_provider: MarketBillingProvider | "";
  operator_notes: string;
  effective_from: string;
  active: boolean;
};

type OneOffPriceDraft = {
  amount_minor: string;
  provider: MarketBillingProvider;
  role: "tenant" | "landlord" | "agent" | "";
  tier: MarketPricingControlPlaneTier | "";
  enabled: boolean;
  operator_notes: string;
  effective_from: string;
  active: boolean;
};

type EntitlementDraft = {
  active_listing_limit: string;
  listing_credits: string;
  featured_credits: string;
  client_page_limit: string;
  payg_beyond_cap_enabled: boolean;
  operator_notes: string;
  effective_from: string;
  active: boolean;
};

type SaveState = {
  error: string | null;
  success: string | null;
};

const POLICY_STATE_OPTIONS: MarketPricingPolicyState[] = ["draft", "approved", "live", "disabled"];
const PROVIDER_OPTIONS: MarketBillingProvider[] = ["stripe", "paystack", "flutterwave"];
const ONE_OFF_ROLE_OPTIONS = ["", "landlord", "agent", "tenant"] as const;

function formatAmount(currency: string, amountMinor: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function getAllowedTierOptionsForRole(role: OneOffPriceDraft["role"]) {
  if (role === "tenant") return ["", "free", "tenant_pro"] as const;
  if (role === "landlord") return ["", "free", "starter", "pro"] as const;
  if (role === "agent") return ["", "free", "starter", "pro", "enterprise"] as const;
  return [""] as const;
}

function isAllowedTierForRole(role: OneOffPriceDraft["role"], tier: OneOffPriceDraft["tier"]) {
  return getAllowedTierOptionsForRole(role).some((option) => option === tier);
}

function toDateTimeLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseNonNegativeInteger(value: string, label: string) {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function PolicyLanesSummary({ row }: { row: MarketBillingPolicyRow }) {
  return (
    <>
      Rental {row.rental_enabled ? "Yes" : "No"} · Sale {row.sale_enabled ? "Yes" : "No"} · Shortlet{" "}
      {row.shortlet_enabled ? "Yes" : "No"}
      <br />
      PAYG {row.payg_listing_enabled ? "Yes" : "No"} · Featured {row.featured_listing_enabled ? "Yes" : "No"} · Subs{" "}
      {row.subscription_checkout_enabled ? "Yes" : "No"}
    </>
  );
}

function PolicyEditForm({
  row,
  draft,
  pending,
  state,
  onCancel,
  onChange,
  onSave,
}: {
  row: MarketBillingPolicyRow;
  draft: PolicyDraft;
  pending: boolean;
  state: SaveState;
  onCancel: () => void;
  onChange: (patch: Partial<PolicyDraft>) => void;
  onSave: () => void;
}) {
  const providerHelp = row.market_country === "CA"
    ? "Canada may stay draft-edited here, but live activation is blocked until policy approval and runtime integration ship."
    : "Editing this row updates only the control plane. Runtime checkout still uses legacy settings.";

  return (
    <tr data-testid={`market-policy-edit-${row.id}`}>
      <td colSpan={7} className="bg-slate-50 px-3 py-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Policy state</span>
            <Select
              value={draft.policy_state}
              onChange={(event) => onChange({ policy_state: event.target.value as MarketPricingPolicyState })}
              disabled={pending}
            >
              {POLICY_STATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatMarketPricingPolicyStateLabel(option)}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Listing PAYG provider</span>
            <Select
              value={draft.listing_payg_provider}
              onChange={(event) =>
                onChange({ listing_payg_provider: event.target.value as MarketBillingProvider | "" })
              }
              disabled={pending}
            >
              <option value="">No provider</option>
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Featured listing provider</span>
            <Select
              value={draft.featured_listing_provider}
              onChange={(event) =>
                onChange({ featured_listing_provider: event.target.value as MarketBillingProvider | "" })
              }
              disabled={pending}
            >
              <option value="">No provider</option>
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["rental_enabled", "Rental enabled"],
            ["sale_enabled", "Sale enabled"],
            ["shortlet_enabled", "Shortlet enabled"],
            ["payg_listing_enabled", "PAYG listing enabled"],
            ["featured_listing_enabled", "Featured listing enabled"],
            ["subscription_checkout_enabled", "Subscription checkout enabled"],
            ["active", "Row active"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(draft[key as keyof PolicyDraft])}
                onChange={(event) => onChange({ [key]: event.target.checked } as Partial<PolicyDraft>)}
                disabled={pending}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Operator notes</span>
            <textarea
              value={draft.operator_notes}
              onChange={(event) => onChange({ operator_notes: event.target.value })}
              disabled={pending}
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Effective from</span>
            <Input
              type="datetime-local"
              value={draft.effective_from}
              onChange={(event) => onChange({ effective_from: event.target.value })}
              disabled={pending}
            />
            <p className="text-xs text-slate-500">{providerHelp}</p>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={onSave} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
          {state.success ? <p className="text-xs text-emerald-600">{state.success}</p> : null}
        </div>
      </td>
    </tr>
  );
}

function OneOffPriceEditForm({
  row,
  draft,
  pending,
  state,
  onCancel,
  onChange,
  onSave,
}: {
  row: MarketOneOffPriceRow;
  draft: OneOffPriceDraft;
  pending: boolean;
  state: SaveState;
  onCancel: () => void;
  onChange: (patch: Partial<OneOffPriceDraft>) => void;
  onSave: () => void;
}) {
  const allowedTierOptions = getAllowedTierOptionsForRole(draft.role);
  return (
    <tr data-testid={`market-price-edit-${row.id}`}>
      <td colSpan={9} className="bg-slate-50 px-3 py-4">
        <div className="grid gap-4 lg:grid-cols-5">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Amount (minor units)</span>
            <Input
              value={draft.amount_minor}
              onChange={(event) => onChange({ amount_minor: event.target.value })}
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={pending}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Provider</span>
            <Select
              value={draft.provider}
              onChange={(event) => onChange({ provider: event.target.value as MarketBillingProvider })}
              disabled={pending}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Role</span>
            <Select
              value={draft.role}
              onChange={(event) =>
                onChange({
                  role: event.target.value as OneOffPriceDraft["role"],
                  tier: isAllowedTierForRole(
                    event.target.value as OneOffPriceDraft["role"],
                    draft.tier
                  )
                    ? draft.tier
                    : "",
                })
              }
              disabled={pending}
            >
              <option value="">All roles</option>
              {ONE_OFF_ROLE_OPTIONS.filter((option) => option !== "").map((option) => (
                <option key={option} value={option}>
                  {formatMarketPricingRoleLabel(option)}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Tier</span>
            <Select
              value={draft.tier}
              onChange={(event) => onChange({ tier: event.target.value as OneOffPriceDraft["tier"] })}
              disabled={pending}
            >
              <option value="">All tiers</option>
              {allowedTierOptions.filter((option) => option !== "").map((option) => (
                <option key={option} value={option}>
                  {formatMarketPricingControlPlaneTierLabel(option)}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Effective from</span>
            <Input
              type="datetime-local"
              value={draft.effective_from}
              onChange={(event) => onChange({ effective_from: event.target.value })}
              disabled={pending}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => onChange({ enabled: event.target.checked })}
              disabled={pending}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Enabled</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => onChange({ active: event.target.checked })}
              disabled={pending}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Row active</span>
          </label>
        </div>

        <label className="mt-4 block space-y-1 text-sm text-slate-700">
          <span className="font-medium">Operator notes</span>
          <textarea
            value={draft.operator_notes}
            onChange={(event) => onChange({ operator_notes: event.target.value })}
            disabled={pending}
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <p className="mt-3 text-xs text-slate-500">
          Role/tier prices are control-plane rows only until runtime integration ships. Enterprise rows are planning-only until Enterprise runtime tier support is implemented.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={onSave} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
          {state.success ? <p className="text-xs text-emerald-600">{state.success}</p> : null}
        </div>
      </td>
    </tr>
  );
}

function EntitlementEditForm({
  row,
  draft,
  pending,
  state,
  onCancel,
  onChange,
  onSave,
}: {
  row: MarketListingEntitlementRow;
  draft: EntitlementDraft;
  pending: boolean;
  state: SaveState;
  onCancel: () => void;
  onChange: (patch: Partial<EntitlementDraft>) => void;
  onSave: () => void;
}) {
  return (
    <tr data-testid={`market-entitlement-edit-${row.id}`}>
      <td colSpan={7} className="bg-slate-50 px-3 py-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Active listing limit</span>
            <Input value={draft.active_listing_limit} onChange={(event) => onChange({ active_listing_limit: event.target.value })} inputMode="numeric" pattern="[0-9]*" disabled={pending} />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Listing credits</span>
            <Input value={draft.listing_credits} onChange={(event) => onChange({ listing_credits: event.target.value })} inputMode="numeric" pattern="[0-9]*" disabled={pending} />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Featured credits</span>
            <Input value={draft.featured_credits} onChange={(event) => onChange({ featured_credits: event.target.value })} inputMode="numeric" pattern="[0-9]*" disabled={pending} />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Client page limit</span>
            <Input value={draft.client_page_limit} onChange={(event) => onChange({ client_page_limit: event.target.value })} inputMode="numeric" pattern="[0-9]*" placeholder="Blank for none" disabled={pending} />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.payg_beyond_cap_enabled}
              onChange={(event) => onChange({ payg_beyond_cap_enabled: event.target.checked })}
              disabled={pending}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>PAYG beyond cap enabled</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => onChange({ active: event.target.checked })}
              disabled={pending}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Row active</span>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Effective from</span>
            <Input
              type="datetime-local"
              value={draft.effective_from}
              onChange={(event) => onChange({ effective_from: event.target.value })}
              disabled={pending}
            />
          </label>
        </div>

        <label className="mt-4 block space-y-1 text-sm text-slate-700">
          <span className="font-medium">Operator notes</span>
          <textarea
            value={draft.operator_notes}
            onChange={(event) => onChange({ operator_notes: event.target.value })}
            disabled={pending}
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={onSave} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
          {state.success ? <p className="text-xs text-emerald-600">{state.success}</p> : null}
        </div>
      </td>
    </tr>
  );
}

export function AdminMarketPricingControlPlaneEditor({
  policies,
  oneOffPrices,
  entitlements,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingEntitlementId, setEditingEntitlementId] = useState<string | null>(null);
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft | null>(null);
  const [priceDraft, setPriceDraft] = useState<OneOffPriceDraft | null>(null);
  const [entitlementDraft, setEntitlementDraft] = useState<EntitlementDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ error: null, success: null });

  const resetMessages = () => setSaveState({ error: null, success: null });

  const startPolicyEdit = (row: MarketBillingPolicyRow) => {
    resetMessages();
    setEditingPriceId(null);
    setEditingEntitlementId(null);
    setEditingPolicyId(row.id);
    setPolicyDraft({
      policy_state: row.policy_state,
      rental_enabled: row.rental_enabled,
      sale_enabled: row.sale_enabled,
      shortlet_enabled: row.shortlet_enabled,
      payg_listing_enabled: row.payg_listing_enabled,
      featured_listing_enabled: row.featured_listing_enabled,
      subscription_checkout_enabled: row.subscription_checkout_enabled,
      listing_payg_provider: row.listing_payg_provider ?? "",
      featured_listing_provider: row.featured_listing_provider ?? "",
      operator_notes: row.operator_notes ?? "",
      effective_from: toDateTimeLocalInput(row.effective_from),
      active: row.active,
    });
  };

  const startOneOffPriceEdit = (row: MarketOneOffPriceRow) => {
    resetMessages();
    setEditingPolicyId(null);
    setEditingEntitlementId(null);
    setEditingPriceId(row.id);
    setPriceDraft({
      amount_minor: String(row.amount_minor),
      provider: row.provider,
      role: row.role ?? "",
      tier: row.tier ?? "",
      enabled: row.enabled,
      operator_notes: row.operator_notes ?? "",
      effective_from: toDateTimeLocalInput(row.effective_from),
      active: row.active,
    });
  };

  const startEntitlementEdit = (row: MarketListingEntitlementRow) => {
    resetMessages();
    setEditingPolicyId(null);
    setEditingPriceId(null);
    setEditingEntitlementId(row.id);
    setEntitlementDraft({
      active_listing_limit: String(row.active_listing_limit),
      listing_credits: String(row.listing_credits),
      featured_credits: String(row.featured_credits),
      client_page_limit: row.client_page_limit === null ? "" : String(row.client_page_limit),
      payg_beyond_cap_enabled: row.payg_beyond_cap_enabled,
      operator_notes: row.operator_notes ?? "",
      effective_from: toDateTimeLocalInput(row.effective_from),
      active: row.active,
    });
  };

  const savePolicy = () => {
    if (!editingPolicyId || !policyDraft) return;
    resetMessages();
    startTransition(async () => {
      const response = await fetch(`/api/admin/market-pricing/policies/${editingPolicyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...policyDraft,
          listing_payg_provider: policyDraft.listing_payg_provider || null,
          featured_listing_provider: policyDraft.featured_listing_provider || null,
          operator_notes: policyDraft.operator_notes || null,
          effective_from: toIsoOrNull(policyDraft.effective_from),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveState({ error: payload?.error || "Unable to update market policy row.", success: null });
        return;
      }
      setSaveState({
        error: null,
        success: "Policy row saved. Runtime billing still stays legacy-backed until a future integration batch ships.",
      });
      setEditingPolicyId(null);
      setPolicyDraft(null);
      router.refresh();
    });
  };

  const saveOneOffPrice = () => {
    if (!editingPriceId || !priceDraft) return;
    resetMessages();
    startTransition(async () => {
      let amountMinor: number;
      try {
        amountMinor = parseNonNegativeInteger(priceDraft.amount_minor, "Amount");
      } catch (error) {
        setSaveState({
          error: error instanceof Error ? error.message : "Amount must be a non-negative integer.",
          success: null,
        });
        return;
      }

      const response = await fetch(`/api/admin/market-pricing/one-off-prices/${editingPriceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_minor: amountMinor,
          provider: priceDraft.provider,
          role: priceDraft.role || null,
          tier: priceDraft.tier || null,
          enabled: priceDraft.enabled,
          operator_notes: priceDraft.operator_notes || null,
          effective_from: toIsoOrNull(priceDraft.effective_from),
          active: priceDraft.active,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveState({ error: payload?.error || "Unable to update one-off price row.", success: null });
        return;
      }
      setSaveState({
        error: null,
        success: "One-off price row saved. Runtime checkout still uses legacy PAYG and featured pricing paths.",
      });
      setEditingPriceId(null);
      setPriceDraft(null);
      router.refresh();
    });
  };

  const saveEntitlement = () => {
    if (!editingEntitlementId || !entitlementDraft) return;
    resetMessages();
    startTransition(async () => {
      let activeListingLimit: number;
      let listingCredits: number;
      let featuredCredits: number;
      let clientPageLimit: number | null = null;

      try {
        activeListingLimit = parseNonNegativeInteger(
          entitlementDraft.active_listing_limit,
          "Active listing limit"
        );
        listingCredits = parseNonNegativeInteger(entitlementDraft.listing_credits, "Listing credits");
        featuredCredits = parseNonNegativeInteger(
          entitlementDraft.featured_credits,
          "Featured credits"
        );
        clientPageLimit = entitlementDraft.client_page_limit.trim()
          ? parseNonNegativeInteger(entitlementDraft.client_page_limit, "Client page limit")
          : null;
      } catch (error) {
        setSaveState({
          error: error instanceof Error ? error.message : "Entitlement values must be non-negative integers.",
          success: null,
        });
        return;
      }

      const response = await fetch(`/api/admin/market-pricing/entitlements/${editingEntitlementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_listing_limit: activeListingLimit,
          listing_credits: listingCredits,
          featured_credits: featuredCredits,
          client_page_limit: clientPageLimit,
          payg_beyond_cap_enabled: entitlementDraft.payg_beyond_cap_enabled,
          operator_notes: entitlementDraft.operator_notes || null,
          effective_from: toIsoOrNull(entitlementDraft.effective_from),
          active: entitlementDraft.active,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveState({ error: payload?.error || "Unable to update entitlement row.", success: null });
        return;
      }
      setSaveState({
        error: null,
        success: "Entitlement row saved. Listing caps and credits in runtime still resolve from legacy plan truth today.",
      });
      setEditingEntitlementId(null);
      setEntitlementDraft(null);
      router.refresh();
    });
  };

  return (
    <div data-testid="market-pricing-control-plane-editor" className="contents">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="market-pricing-policies-section">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Market policy rows</p>
            <p className="mt-1 text-sm text-slate-600">
              Per-market commercial gating and provider envelope. Admin edits update the control plane only; runtime billing remains unchanged.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Providers</th>
                <th className="px-3 py-2">Enabled lanes</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.map((row) => (
                <Fragment key={row.id}>
                  <tr key={row.id}>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.market_country}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMarketPricingPolicyStateLabel(row.policy_state)}</td>
                    <td className="px-3 py-3 text-slate-700">{row.currency}</td>
                    <td className="px-3 py-3 text-slate-700">
                      Listing: {row.listing_payg_provider ?? "—"}
                      <br />
                      Featured: {row.featured_listing_provider ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <PolicyLanesSummary row={row} />
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.operator_notes ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => startPolicyEdit(row)}
                        disabled={pending}
                        data-testid={`market-policy-edit-button-${row.id}`}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                  {editingPolicyId === row.id && policyDraft ? (
                    <PolicyEditForm
                      row={row}
                      draft={policyDraft}
                      pending={pending}
                      state={saveState}
                      onCancel={() => {
                        setEditingPolicyId(null);
                        setPolicyDraft(null);
                        resetMessages();
                      }}
                      onChange={(patch) => setPolicyDraft((current) => (current ? { ...current, ...patch } : current))}
                      onSave={savePolicy}
                    />
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="market-pricing-one-off-section">
        <div>
          <p className="text-sm font-semibold text-slate-900">One-off price rows</p>
          <p className="mt-1 text-sm text-slate-600">
            Future market-aware PAYG and featured pricing rows. Editing these rows does not change checkout runtime in this batch.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Role/tier prices are control-plane rows only until runtime integration ships. Enterprise rows are planning-only until Enterprise runtime tier support is implemented.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {oneOffPrices.map((row) => (
                <Fragment key={row.id}>
                  <tr key={row.id}>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.market_country}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMarketPricingProductLabel(row.product_code)}</td>
                    <td className="px-3 py-3 text-slate-700">{row.provider}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMarketPricingRoleScopeLabel(row.role)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMarketPricingControlPlaneTierLabel(row.tier)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatAmount(row.currency, row.amount_minor)}</td>
                    <td className="px-3 py-3 text-slate-700">{row.enabled ? "Yes" : "No"}</td>
                    <td className="px-3 py-3 text-slate-700">{row.operator_notes ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => startOneOffPriceEdit(row)}
                        disabled={pending}
                        data-testid={`market-one-off-edit-button-${row.id}`}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                  {editingPriceId === row.id && priceDraft ? (
                    <OneOffPriceEditForm
                      row={row}
                      draft={priceDraft}
                      pending={pending}
                      state={saveState}
                      onCancel={() => {
                        setEditingPriceId(null);
                        setPriceDraft(null);
                        resetMessages();
                      }}
                      onChange={(patch) => setPriceDraft((current) => (current ? { ...current, ...patch } : current))}
                      onSave={saveOneOffPrice}
                    />
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="market-pricing-entitlements-section">
        <div>
          <p className="text-sm font-semibold text-slate-900">Listing entitlement rows</p>
          <p className="mt-1 text-sm text-slate-600">
            Market x role x tier matrix for future listing-cap and credit control. Admin edits stay read-only to runtime in this batch.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Active listing limit</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entitlements.map((row) => (
                <Fragment key={row.id}>
                  <tr key={row.id}>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.market_country}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMarketPricingRoleLabel(row.role)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatMarketPricingTierLabel(row.tier)}</td>
                    <td className="px-3 py-3 text-slate-700">{row.active_listing_limit}</td>
                    <td className="px-3 py-3 text-slate-700">
                      Listing {row.listing_credits} · Featured {row.featured_credits}
                      <br />
                      Client pages {row.client_page_limit ?? "—"} · Beyond cap {row.payg_beyond_cap_enabled ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.operator_notes ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => startEntitlementEdit(row)}
                        disabled={pending}
                        data-testid={`market-entitlement-edit-button-${row.id}`}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                  {editingEntitlementId === row.id && entitlementDraft ? (
                    <EntitlementEditForm
                      row={row}
                      draft={entitlementDraft}
                      pending={pending}
                      state={saveState}
                      onCancel={() => {
                        setEditingEntitlementId(null);
                        setEntitlementDraft(null);
                        resetMessages();
                      }}
                      onChange={(patch) =>
                        setEntitlementDraft((current) => (current ? { ...current, ...patch } : current))
                      }
                      onSave={saveEntitlement}
                    />
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
