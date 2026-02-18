"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Props = {
  propertyId: string;
  propertyTitle: string | null;
  propertyCity: string | null;
  listingCurrency: string | null;
  selectedMarketLabel: string | null;
  showMarketMismatchHint: boolean;
};

export function HostShortletConversionCard({
  propertyId,
  propertyTitle,
  propertyCity,
  listingCurrency,
  selectedMarketLabel,
  showMarketMismatchHint,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function convertToShortlet() {
    if (busy) return;
    const confirmed = window.confirm(
      "Convert this listing to a shortlet now? This will set listing intent to Shortlet and rental type to Short-let."
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_intent: "shortlet",
          rental_type: "short_let",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; fieldErrors?: Record<string, string> }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to convert listing to shortlet.");
      }
      window.location.reload();
    } catch (conversionError) {
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "Unable to convert listing to shortlet."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Shortlet setup</p>
        <h1 className="text-xl font-semibold text-amber-950">
          {propertyTitle || "Convert listing to shortlet"}
        </h1>
        <p className="text-sm text-amber-900">
          {propertyCity || "Unknown city"} · Currency {listingCurrency || "NGN"}
        </p>
      </div>

      <p className="text-sm text-amber-900">
        This listing is not currently marked as a shortlet, so booking availability settings are
        hidden to avoid an inconsistent state.
      </p>

      {showMarketMismatchHint ? (
        <p className="text-xs text-amber-800">
          Selected market is {selectedMarketLabel || "different from this listing"}. Switch market
          in the header to match this listing before managing shortlet setup.
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void convertToShortlet()} disabled={busy}>
          {busy ? "Converting..." : "Convert this listing to a shortlet"}
        </Button>
        <Link
          href={`/dashboard/properties/${encodeURIComponent(propertyId)}?step=basics`}
          className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          Edit listing basics
        </Link>
        <Link
          href="/host"
          className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          Back to host
        </Link>
      </div>
    </section>
  );
}
