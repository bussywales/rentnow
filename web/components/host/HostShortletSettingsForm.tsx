"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ShortletCancellationPolicy } from "@/lib/shortlet/cancellation";

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
    cancellation_policy?: ShortletCancellationPolicy | null;
    checkin_instructions?: string | null;
    checkin_window_start?: string | null;
    checkin_window_end?: string | null;
    checkout_time?: string | null;
    access_method?: string | null;
    access_code_hint?: string | null;
    parking_info?: string | null;
    wifi_info?: string | null;
    house_rules?: string | null;
    quiet_hours_start?: string | null;
    quiet_hours_end?: string | null;
    pets_allowed?: boolean | null;
    smoking_allowed?: boolean | null;
    parties_allowed?: boolean | null;
    max_guests_override?: number | null;
    emergency_notes?: string | null;
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const [cancellationPolicy, setCancellationPolicy] = useState<ShortletCancellationPolicy>(
    initialSettings.cancellation_policy ?? "flexible_48h"
  );
  const [checkinInstructions, setCheckinInstructions] = useState(
    initialSettings.checkin_instructions ?? ""
  );
  const [checkinWindowStart, setCheckinWindowStart] = useState(
    initialSettings.checkin_window_start ?? ""
  );
  const [checkinWindowEnd, setCheckinWindowEnd] = useState(
    initialSettings.checkin_window_end ?? ""
  );
  const [checkoutTime, setCheckoutTime] = useState(initialSettings.checkout_time ?? "");
  const [accessMethod, setAccessMethod] = useState(initialSettings.access_method ?? "");
  const [accessCodeHint, setAccessCodeHint] = useState(initialSettings.access_code_hint ?? "");
  const [parkingInfo, setParkingInfo] = useState(initialSettings.parking_info ?? "");
  const [wifiInfo, setWifiInfo] = useState(initialSettings.wifi_info ?? "");
  const [houseRules, setHouseRules] = useState(initialSettings.house_rules ?? "");
  const [quietHoursStart, setQuietHoursStart] = useState(
    initialSettings.quiet_hours_start ?? ""
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(initialSettings.quiet_hours_end ?? "");
  const [petsAllowed, setPetsAllowed] = useState<"unset" | "yes" | "no">(
    initialSettings.pets_allowed === true
      ? "yes"
      : initialSettings.pets_allowed === false
        ? "no"
        : "unset"
  );
  const [smokingAllowed, setSmokingAllowed] = useState<"unset" | "yes" | "no">(
    initialSettings.smoking_allowed === true
      ? "yes"
      : initialSettings.smoking_allowed === false
        ? "no"
        : "unset"
  );
  const [partiesAllowed, setPartiesAllowed] = useState<"unset" | "yes" | "no">(
    initialSettings.parties_allowed === true
      ? "yes"
      : initialSettings.parties_allowed === false
        ? "no"
        : "unset"
  );
  const [maxGuestsOverride, setMaxGuestsOverride] = useState(
    initialSettings.max_guests_override && initialSettings.max_guests_override > 0
      ? String(initialSettings.max_guests_override)
      : ""
  );
  const [emergencyNotes, setEmergencyNotes] = useState(
    initialSettings.emergency_notes ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nightlyPreview = useMemo(() => {
    const parsed = Number(nightlyPriceMinor || "0");
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return formatMoney(currency, parsed);
  }, [currency, nightlyPriceMinor]);

  const guestPreviewRules = useMemo(() => {
    const rules: string[] = [];
    if (houseRules.trim()) rules.push(houseRules.trim());
    if (petsAllowed === "no") rules.push("Pets are not allowed.");
    if (petsAllowed === "yes") rules.push("Pets are allowed.");
    if (smokingAllowed === "no") rules.push("Smoking is not allowed.");
    if (smokingAllowed === "yes") rules.push("Smoking is allowed.");
    if (partiesAllowed === "no") rules.push("Parties are not allowed.");
    if (partiesAllowed === "yes") rules.push("Parties are allowed.");
    if (quietHoursStart && quietHoursEnd) {
      rules.push(`Quiet hours: ${quietHoursStart} - ${quietHoursEnd}.`);
    }
    if (maxGuestsOverride) {
      rules.push(`Maximum guests: ${maxGuestsOverride}.`);
    }
    return rules;
  }, [houseRules, maxGuestsOverride, partiesAllowed, petsAllowed, quietHoursEnd, quietHoursStart, smokingAllowed]);

  function normalizeOptionalText(value: string) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function normalizeOptionalTime(value: string) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function normalizeOptionalBoolean(value: "unset" | "yes" | "no") {
    if (value === "yes") return true;
    if (value === "no") return false;
    return null;
  }

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
          cancellation_policy: cancellationPolicy,
          checkin_instructions: normalizeOptionalText(checkinInstructions),
          checkin_window_start: normalizeOptionalTime(checkinWindowStart),
          checkin_window_end: normalizeOptionalTime(checkinWindowEnd),
          checkout_time: normalizeOptionalTime(checkoutTime),
          access_method: normalizeOptionalText(accessMethod),
          access_code_hint: normalizeOptionalText(accessCodeHint),
          parking_info: normalizeOptionalText(parkingInfo),
          wifi_info: normalizeOptionalText(wifiInfo),
          house_rules: normalizeOptionalText(houseRules),
          quiet_hours_start: normalizeOptionalTime(quietHoursStart),
          quiet_hours_end: normalizeOptionalTime(quietHoursEnd),
          pets_allowed: normalizeOptionalBoolean(petsAllowed),
          smoking_allowed: normalizeOptionalBoolean(smokingAllowed),
          parties_allowed: normalizeOptionalBoolean(partiesAllowed),
          max_guests_override: maxGuestsOverride
            ? Math.max(1, Math.trunc(Number(maxGuestsOverride || "0")))
            : null,
          emergency_notes: normalizeOptionalText(emergencyNotes),
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
        <label htmlFor="cancellation-policy" className="text-sm font-medium text-slate-700">
          Cancellation policy
        </label>
        <select
          id="cancellation-policy"
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
          value={cancellationPolicy}
          onChange={(event) =>
            setCancellationPolicy(event.target.value as ShortletCancellationPolicy)
          }
        >
          <option value="flexible_24h">Free cancellation until 24h before check-in</option>
          <option value="flexible_48h">Free cancellation until 48h before check-in</option>
          <option value="moderate_5d">Free cancellation until 5 days before check-in</option>
          <option value="strict">Strict (no free cancellation)</option>
        </select>
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

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="shortlet-checkin-rules-section">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Guest arrival &amp; house rules</h2>
            <p className="text-xs text-slate-600">
              Keep instructions clear and safe. Avoid sharing exact lock codes until booking is confirmed.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            onClick={() => setAdvancedOpen((prev) => !prev)}
          >
            {advancedOpen ? "Hide advanced fields" : "Show advanced fields"}
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="checkin-instructions" className="text-sm font-medium text-slate-700">
            Check-in instructions
          </label>
          <textarea
            id="checkin-instructions"
            value={checkinInstructions}
            onChange={(event) => setCheckinInstructions(event.target.value)}
            maxLength={4000}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            placeholder="Share arrival flow, building entry guidance, and timing expectations."
          />
          <p className="text-[11px] text-slate-500">{checkinInstructions.length}/4000</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="checkin-window-start" className="text-sm font-medium text-slate-700">
              Check-in window start
            </label>
            <Input
              id="checkin-window-start"
              type="time"
              value={checkinWindowStart}
              onChange={(event) => setCheckinWindowStart(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="checkin-window-end" className="text-sm font-medium text-slate-700">
              Check-in window end
            </label>
            <Input
              id="checkin-window-end"
              type="time"
              value={checkinWindowEnd}
              onChange={(event) => setCheckinWindowEnd(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="checkout-time" className="text-sm font-medium text-slate-700">
              Checkout time
            </label>
            <Input
              id="checkout-time"
              type="time"
              value={checkoutTime}
              onChange={(event) => setCheckoutTime(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="access-method" className="text-sm font-medium text-slate-700">
              Access method
            </label>
            <select
              id="access-method"
              value={accessMethod}
              onChange={(event) => setAccessMethod(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
            >
              <option value="">Not set</option>
              <option value="Lockbox">Lockbox</option>
              <option value="Key handover">Key handover</option>
              <option value="Front desk">Front desk</option>
              <option value="Self check-in">Self check-in</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="access-code-hint" className="text-sm font-medium text-slate-700">
              Access hint (optional)
            </label>
            <Input
              id="access-code-hint"
              value={accessCodeHint}
              maxLength={500}
              onChange={(event) => setAccessCodeHint(event.target.value)}
              placeholder="e.g. lockbox on gate, code shared after approval"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="house-rules" className="text-sm font-medium text-slate-700">
            House rules
          </label>
          <textarea
            id="house-rules"
            value={houseRules}
            onChange={(event) => setHouseRules(event.target.value)}
            maxLength={4000}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            placeholder="Set clear expectations for guests."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="pets-allowed" className="text-sm font-medium text-slate-700">
              Pets
            </label>
            <select
              id="pets-allowed"
              value={petsAllowed}
              onChange={(event) => setPetsAllowed(event.target.value as "unset" | "yes" | "no")}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
            >
              <option value="unset">Not set</option>
              <option value="yes">Allowed</option>
              <option value="no">Not allowed</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="smoking-allowed" className="text-sm font-medium text-slate-700">
              Smoking
            </label>
            <select
              id="smoking-allowed"
              value={smokingAllowed}
              onChange={(event) => setSmokingAllowed(event.target.value as "unset" | "yes" | "no")}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
            >
              <option value="unset">Not set</option>
              <option value="yes">Allowed</option>
              <option value="no">Not allowed</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="parties-allowed" className="text-sm font-medium text-slate-700">
              Parties
            </label>
            <select
              id="parties-allowed"
              value={partiesAllowed}
              onChange={(event) => setPartiesAllowed(event.target.value as "unset" | "yes" | "no")}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
            >
              <option value="unset">Not set</option>
              <option value="yes">Allowed</option>
              <option value="no">Not allowed</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="quiet-hours-start" className="text-sm font-medium text-slate-700">
              Quiet hours start
            </label>
            <Input
              id="quiet-hours-start"
              type="time"
              value={quietHoursStart}
              onChange={(event) => setQuietHoursStart(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="quiet-hours-end" className="text-sm font-medium text-slate-700">
              Quiet hours end
            </label>
            <Input
              id="quiet-hours-end"
              type="time"
              value={quietHoursEnd}
              onChange={(event) => setQuietHoursEnd(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="max-guests-override" className="text-sm font-medium text-slate-700">
              Max guests (optional)
            </label>
            <Input
              id="max-guests-override"
              type="number"
              min={1}
              value={maxGuestsOverride}
              onChange={(event) => setMaxGuestsOverride(event.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>

        {advancedOpen ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="space-y-2">
              <label htmlFor="parking-info" className="text-sm font-medium text-slate-700">
                Parking info
              </label>
              <textarea
                id="parking-info"
                value={parkingInfo}
                onChange={(event) => setParkingInfo(event.target.value)}
                maxLength={2000}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                placeholder="Share parking availability and restrictions."
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="wifi-info" className="text-sm font-medium text-slate-700">
                Wi-Fi info
              </label>
              <textarea
                id="wifi-info"
                value={wifiInfo}
                onChange={(event) => setWifiInfo(event.target.value)}
                maxLength={2000}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                placeholder="Optional network instructions. Avoid sharing sensitive passwords publicly."
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="emergency-notes" className="text-sm font-medium text-slate-700">
                Emergency notes
              </label>
              <textarea
                id="emergency-notes"
                value={emergencyNotes}
                onChange={(event) => setEmergencyNotes(event.target.value)}
                maxLength={2000}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                placeholder="Nearby landmarks or non-sensitive guidance."
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-3" data-testid="shortlet-checkin-rules-preview">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Preview as guest</p>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Check-in details</p>
            <p>{checkinInstructions.trim() || "Check-in details will be shared by host."}</p>
            <p>
              Window: {checkinWindowStart || "Not set"} to {checkinWindowEnd || "Not set"}
            </p>
            <p>Checkout: {checkoutTime || "Not set"}</p>
            <p>Access: {accessMethod || "Not set"}</p>
            {guestPreviewRules.length ? (
              <>
                <p className="mt-2 font-medium text-slate-900">House rules</p>
                <ul className="list-disc pl-5">
                  {guestPreviewRules.slice(0, 5).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
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
