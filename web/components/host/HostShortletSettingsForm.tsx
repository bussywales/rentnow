"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  propertyId: string;
  propertyTitle: string | null;
  propertyCity: string | null;
  currency: string;
  selectedMarketLabel?: string | null;
  marketMismatchHint?: boolean;
  initialSettings: {
    booking_mode: "instant" | "request";
    nightly_price_minor: number | null;
    cleaning_fee_minor?: number | null;
    deposit_minor?: number | null;
  };
};

function formatMoney(currency: string, amountMinor: number): string {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

export function HostShortletSettingsForm({
  propertyId,
  propertyTitle,
  propertyCity,
  currency,
  selectedMarketLabel = null,
  marketMismatchHint = false,
  initialSettings,
}: Props) {
  const [bookingMode, setBookingMode] = useState<"instant" | "request">(
    initialSettings.booking_mode === "instant" ? "instant" : "request"
  );
  const [nightlyPriceMinor, setNightlyPriceMinor] = useState<string>(
    typeof initialSettings.nightly_price_minor === "number" && initialSettings.nightly_price_minor > 0
      ? String(initialSettings.nightly_price_minor)
      : ""
  );
  const [cleaningFeeMinor, setCleaningFeeMinor] = useState<string>(
    String(initialSettings.cleaning_fee_minor ?? 0)
  );
  const [depositMinor, setDepositMinor] = useState<string>(String(initialSettings.deposit_minor ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nightlyPreview = useMemo(() => {
    const parsed = Number(nightlyPriceMinor || "0");
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return formatMoney(currency, parsed);
  }, [currency, nightlyPriceMinor]);

  async function save() {
    const nightly = Math.trunc(Number(nightlyPriceMinor || "0"));
    if (!Number.isFinite(nightly) || nightly <= 0) {
      setError("Nightly price is required and must be greater than 0.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/shortlet/settings/${propertyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_mode: bookingMode,
          nightly_price_minor: nightly,
          cleaning_fee_minor: Math.max(0, Math.trunc(Number(cleaningFeeMinor || "0"))),
          deposit_minor: Math.max(0, Math.trunc(Number(depositMinor || "0"))),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update shortlet settings.");
      }
      setNotice("Shortlet settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update shortlet settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manage shortlet</p>
        <h1 className="text-xl font-semibold text-slate-900">{propertyTitle || "Shortlet listing"}</h1>
        <p className="text-sm text-slate-600">
          {propertyCity || "Unknown city"} · Currency {currency || "NGN"}
        </p>
        {marketMismatchHint ? (
          <p className="mt-1 text-xs text-amber-700">
            Selected market: {selectedMarketLabel || "Different market"}.
            {" "}Switch market in the header to match this listing currency when reviewing shortlet setup.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
          <input
            type="radio"
            name="booking_mode"
            className="h-4 w-4"
            checked={bookingMode === "instant"}
            onChange={() => setBookingMode("instant")}
          />
          Instant book
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
          <input
            type="radio"
            name="booking_mode"
            className="h-4 w-4"
            checked={bookingMode === "request"}
            onChange={() => setBookingMode("request")}
          />
          Request to book
        </label>
      </div>

      <div className="space-y-2">
        <label htmlFor="nightly-price-minor" className="text-sm font-medium text-slate-700">
          Nightly price (minor units) <span className="text-rose-500">*</span>
        </label>
        <Input
          id="nightly-price-minor"
          type="number"
          min={1}
          value={nightlyPriceMinor}
          onChange={(event) => setNightlyPriceMinor(event.target.value.replace(/[^\d]/g, ""))}
        />
        {nightlyPreview ? <p className="text-xs text-slate-500">Preview: {nightlyPreview} / night</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="cleaning-fee-minor" className="text-sm font-medium text-slate-700">
            Cleaning fee (optional, minor units)
          </label>
          <Input
            id="cleaning-fee-minor"
            type="number"
            min={0}
            value={cleaningFeeMinor}
            onChange={(event) => setCleaningFeeMinor(event.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="deposit-minor" className="text-sm font-medium text-slate-700">
            Security deposit (optional, minor units)
          </label>
          <Input
            id="deposit-minor"
            type="number"
            min={0}
            value={depositMinor}
            onChange={(event) => setDepositMinor(event.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
        <Link
          href="/host/bookings"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Bookings
        </Link>
        <Link
          href={`/host/shortlets/blocks?property_id=${encodeURIComponent(propertyId)}`}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Availability
        </Link>
        <Link
          href="/host"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to host
        </Link>
      </div>
    </section>
  );
}
