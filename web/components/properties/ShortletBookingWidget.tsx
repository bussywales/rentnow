"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { resolveShortletBookingCtaLabel } from "@/lib/shortlet/booking-cta";

type AvailabilityResponse = {
  bookingMode: "instant" | "request";
  blockedRanges: Array<{
    kind: "booking" | "block";
    id: string;
    from: string;
    to: string;
    status?: string;
    reason?: string | null;
  }>;
  pricing: {
    nights: number;
    nightlyPriceMinor: number;
    subtotalMinor: number;
    cleaningFeeMinor: number;
    depositMinor: number;
    totalAmountMinor: number;
    currency: string;
  } | null;
  settings: {
    nightlyPriceMinor: number | null;
    cleaningFeeMinor: number;
    depositMinor: number;
    minNights: number;
    maxNights: number | null;
  } | null;
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

function getDefaultDate(offsetDays: number): string {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

export function ShortletBookingWidget(props: {
  propertyId: string;
  listingTitle: string;
  isAuthenticated: boolean;
  loginHref: string;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState<string>(getDefaultDate(1));
  const [checkOut, setCheckOut] = useState<string>(getDefaultDate(3));
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!checkIn || !checkOut) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/properties/${encodeURIComponent(props.propertyId)}/availability?from=${encodeURIComponent(checkIn)}&to=${encodeURIComponent(checkOut)}`,
          {
            credentials: "include",
          }
        );
        const payload = (await response.json().catch(() => null)) as AvailabilityResponse | null;
        if (!response.ok || !payload) {
          throw new Error("Unable to load availability");
        }
        if (active) setAvailability(payload);
      } catch (loadError) {
        if (active) {
          setAvailability(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load availability");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [checkIn, checkOut, props.propertyId]);

  const bookingMode = availability?.bookingMode ?? "request";
  const isRequestMode = bookingMode === "request";
  const modeCtaLabel = resolveShortletBookingCtaLabel(bookingMode);
  const ctaLabel = "Continue to payment";
  const blockedCount = availability?.blockedRanges?.length ?? 0;
  const pricing = availability?.pricing ?? null;
  const hasNightlyPriceConfigured =
    typeof availability?.settings?.nightlyPriceMinor === "number" &&
    availability.settings.nightlyPriceMinor > 0;
  const canSubmit = hasNightlyPriceConfigured && !!pricing && blockedCount === 0;
  const priceSummary = useMemo(() => {
    if (!pricing) return null;
    return {
      nightly: formatMoney(pricing.currency, pricing.nightlyPriceMinor),
      subtotal: formatMoney(pricing.currency, pricing.subtotalMinor),
      cleaning: pricing.cleaningFeeMinor > 0 ? formatMoney(pricing.currency, pricing.cleaningFeeMinor) : null,
      deposit: pricing.depositMinor > 0 ? formatMoney(pricing.currency, pricing.depositMinor) : null,
      total: formatMoney(pricing.currency, pricing.totalAmountMinor),
    };
  }, [pricing]);

  async function handleCreateBooking() {
    if (!checkIn || !checkOut || creating) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/shortlet/bookings/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: props.propertyId,
          check_in: checkIn,
          check_out: checkOut,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { booking?: { id?: string; status?: string }; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to create booking");
      }
      const bookingId = typeof payload?.booking?.id === "string" ? payload.booking.id : null;
      if (bookingId) {
        router.push(`/payments/shortlet/checkout?bookingId=${encodeURIComponent(bookingId)}`);
      } else {
        setNotice("Booking created. Continue to payment to complete your booking.");
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create booking");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div id="cta" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Book this shortlet</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {isRequestMode ? "Request mode" : "Instant book"}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {isRequestMode
          ? "Host approval is required after payment succeeds."
          : "Instant confirmation after successful payment when dates are available."}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Check in</span>
          <input
            type="date"
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            min={getDefaultDate(0)}
          />
        </label>
        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Check out</span>
          <input
            type="date"
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            min={checkIn || getDefaultDate(1)}
          />
        </label>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Checking availability...</p>
      ) : (
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {pricing && priceSummary ? (
            <>
              <p>
                {pricing.nights} night{pricing.nights === 1 ? "" : "s"} x {priceSummary.nightly}
              </p>
              <p>Subtotal: {priceSummary.subtotal}</p>
              {priceSummary.cleaning ? <p>Cleaning fee: {priceSummary.cleaning}</p> : null}
              {priceSummary.deposit ? <p>Deposit: {priceSummary.deposit}</p> : null}
              <p className="font-semibold text-slate-900">Total: {priceSummary.total}</p>
              <p className="text-xs text-slate-500">
                Deposit is included in total for this pilot.
              </p>
            </>
          ) : (
            <p>
              {hasNightlyPriceConfigured
                ? "Select valid dates to see pricing."
                : "Nightly pricing is not configured for this shortlet yet."}
            </p>
          )}
          {blockedCount > 0 ? (
            <p className="text-xs text-amber-700">
              {blockedCount} blocked range{blockedCount === 1 ? "" : "s"} overlap this period.
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {props.isAuthenticated ? (
          <Button
            onClick={handleCreateBooking}
            disabled={creating || loading || !checkIn || !checkOut || !canSubmit}
          >
            {creating ? "Submitting..." : ctaLabel}
          </Button>
        ) : (
          <>
            {canSubmit ? (
              <Link href={props.loginHref}>
                <Button>{ctaLabel}</Button>
              </Link>
            ) : (
              <Button disabled>{ctaLabel}</Button>
            )}
          </>
        )}
        {props.isAuthenticated ? (
          <Link
            href="/trips"
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            My trips
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {modeCtaLabel} will be finalised after checkout.
      </p>

      {notice ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-emerald-700">
          <p>{notice}</p>
          <Link
            href="/trips"
            className="font-semibold text-emerald-800 underline underline-offset-2"
          >
            My trips
          </Link>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      <p className="mt-2 text-xs text-slate-500">
        {props.listingTitle} · Marketplace pilot with manual payout handling.
      </p>
    </div>
  );
}
