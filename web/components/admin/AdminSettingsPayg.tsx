"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  paygEnabled: boolean;
  paygAmount: number;
  paygUpdatedAt: string | null;
  amountUpdatedAt: string | null;
  trialAgentCredits: number;
  trialLandlordCredits: number;
  trialAgentUpdatedAt: string | null;
  trialLandlordUpdatedAt: string | null;
  currency?: string;
};

export default function AdminSettingsPayg({
  paygEnabled,
  paygAmount,
  paygUpdatedAt,
  amountUpdatedAt,
  trialAgentCredits,
  trialLandlordCredits,
  trialAgentUpdatedAt,
  trialLandlordUpdatedAt,
  currency = "NGN",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(paygEnabled);
  const [amount, setAmount] = useState(paygAmount);
  const [agentCredits, setAgentCredits] = useState(trialAgentCredits);
  const [landlordCredits, setLandlordCredits] = useState(trialLandlordCredits);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const updateSetting = async (payload: Record<string, unknown>, successMessage: string) => {
    const res = await fetch("/api/admin/app-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Could not update setting");
      return false;
    }
    setToast(successMessage);
    return true;
  };

  const togglePayg = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      const next = !enabled;
      const ok = await updateSetting(
        { key: "payg_enabled", value: { enabled: next } },
        next ? "PAYG enabled." : "PAYG disabled."
      );
      if (ok) setEnabled(next);
    });
  };

  const saveAmount = () => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      await updateSetting(
        { key: "payg_listing_fee_amount", value: { value: amount } },
        "PAYG fee updated."
      );
    });
  };

  const saveTrialCredits = (key: "trial_listing_credits_agent" | "trial_listing_credits_landlord", value: number) => {
    setError(null);
    startTransition(async () => {
      setToast(null);
      await updateSetting({ key, value: { value } }, "Trial credits updated.");
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pay-as-you-go listing fees</h2>
          <p className="text-sm text-slate-600">
            Control the default PAYG fee and trial credits for new listings.
          </p>
          {paygUpdatedAt && (
            <p className="text-xs text-slate-500">
              PAYG toggle updated {new Date(paygUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">{enabled ? "Enabled" : "Disabled"}</span>
          <Button size="sm" variant={enabled ? "secondary" : "primary"} disabled={pending} onClick={togglePayg}>
            {pending ? "Saving..." : enabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">PAYG listing fee</p>
          <p className="text-xs text-slate-600">
            Amount charged when a user runs out of listing credits.
          </p>
          {amountUpdatedAt && (
            <p className="text-xs text-slate-500">
              Updated {new Date(amountUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500" htmlFor="payg-amount">
            {currency}
          </label>
          <input
            id="payg-amount"
            type="number"
            min={0}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            disabled={pending}
          />
          <Button size="sm" onClick={saveAmount} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-900">Trial credits (Agents)</p>
          <p className="text-xs text-slate-600">
            Free listings granted to new agents before PAYG applies.
          </p>
          {trialAgentUpdatedAt && (
            <p className="text-xs text-slate-500">
              Updated {new Date(trialAgentUpdatedAt).toLocaleString()}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={agentCredits}
              onChange={(event) => setAgentCredits(Number(event.target.value))}
              className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              disabled={pending}
            />
            <Button
              size="sm"
              onClick={() => saveTrialCredits("trial_listing_credits_agent", agentCredits)}
              disabled={pending}
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-900">Trial credits (Landlords)</p>
          <p className="text-xs text-slate-600">
            Free listings granted to new landlords before PAYG applies.
          </p>
          {trialLandlordUpdatedAt && (
            <p className="text-xs text-slate-500">
              Updated {new Date(trialLandlordUpdatedAt).toLocaleString()}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={landlordCredits}
              onChange={(event) => setLandlordCredits(Number(event.target.value))}
              className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              disabled={pending}
            />
            <Button
              size="sm"
              onClick={() => saveTrialCredits("trial_listing_credits_landlord", landlordCredits)}
              disabled={pending}
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {toast && <p className="mt-2 text-xs text-emerald-600">{toast}</p>}
    </div>
  );
}
