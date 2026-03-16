"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { MARKET_OPTIONS } from "@/lib/market/market";
import {
  PROPERTY_REQUEST_BEDROOM_OPTIONS,
  PROPERTY_REQUEST_MOVE_TIMELINE_OPTIONS,
  PROPERTY_REQUEST_PROPERTY_TYPE_OPTIONS,
  type PropertyRequest,
  type PropertyRequestIntent,
  type PropertyRequestOwnerWriteStatus,
} from "@/lib/requests/property-requests";

type Props = {
  initialRequest?: PropertyRequest | null;
};

type FormState = {
  intent: PropertyRequestIntent;
  marketCode: string;
  currencyCode: string;
  city: string;
  area: string;
  locationText: string;
  budgetMin: string;
  budgetMax: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  furnished: "" | "true" | "false";
  moveTimeline: string;
  shortletDuration: string;
  notes: string;
};

function buildInitialState(initialRequest?: PropertyRequest | null): FormState {
  const defaultMarket = MARKET_OPTIONS[0];
  return {
    intent: initialRequest?.intent ?? "rent",
    marketCode: initialRequest?.marketCode ?? defaultMarket.country,
    currencyCode: initialRequest?.currencyCode ?? defaultMarket.currency,
    city: initialRequest?.city ?? "",
    area: initialRequest?.area ?? "",
    locationText: initialRequest?.locationText ?? "",
    budgetMin:
      typeof initialRequest?.budgetMin === "number" ? String(initialRequest.budgetMin) : "",
    budgetMax:
      typeof initialRequest?.budgetMax === "number" ? String(initialRequest.budgetMax) : "",
    propertyType: initialRequest?.propertyType ?? "",
    bedrooms:
      typeof initialRequest?.bedrooms === "number" ? String(initialRequest.bedrooms) : "",
    bathrooms:
      typeof initialRequest?.bathrooms === "number" ? String(initialRequest.bathrooms) : "",
    furnished:
      typeof initialRequest?.furnished === "boolean" ? String(initialRequest.furnished) as "true" | "false" : "",
    moveTimeline: initialRequest?.moveTimeline ?? "",
    shortletDuration: initialRequest?.shortletDuration ?? "",
    notes: initialRequest?.notes ?? "",
  };
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildPayload(form: FormState, status: PropertyRequestOwnerWriteStatus) {
  return {
    intent: form.intent,
    marketCode: form.marketCode,
    currencyCode: form.currencyCode,
    city: parseOptionalString(form.city),
    area: parseOptionalString(form.area),
    locationText: parseOptionalString(form.locationText),
    budgetMin: parseOptionalInt(form.budgetMin),
    budgetMax: parseOptionalInt(form.budgetMax),
    propertyType: parseOptionalString(form.propertyType),
    bedrooms: parseOptionalInt(form.bedrooms),
    bathrooms: parseOptionalInt(form.bathrooms),
    furnished:
      form.furnished === "" ? null : form.furnished === "true",
    moveTimeline: parseOptionalString(form.moveTimeline),
    shortletDuration: parseOptionalString(form.shortletDuration),
    notes: parseOptionalString(form.notes),
    status,
  };
}

export function PropertyRequestFormClient({ initialRequest = null }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildInitialState(initialRequest));
  const [pendingAction, setPendingAction] = useState<"draft" | "open" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isShortlet = form.intent === "shortlet";
  const currentStatus = initialRequest?.status ?? "draft";
  const saveActionLabel = currentStatus === "open" ? "Save changes" : "Save draft";

  const marketOptions = useMemo(() => MARKET_OPTIONS, []);

  function handleMarketChange(nextCountry: string) {
    const option = marketOptions.find((entry) => entry.country === nextCountry) ?? marketOptions[0];
    setForm((current) => ({
      ...current,
      marketCode: option.country,
      currencyCode: option.currency,
    }));
  }

  async function submit(nextStatus: "draft" | "open" | "save") {
    setPendingAction(nextStatus);
    setError(null);

    const status =
      nextStatus === "save"
        ? (currentStatus === "open" ? "open" : "draft")
        : nextStatus;

    try {
      const response = await fetch(
        initialRequest ? `/api/requests/${initialRequest.id}` : "/api/requests",
        {
          method: initialRequest ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(buildPayload(form, status)),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | { item?: { id?: string }; error?: string; missingFields?: string[] }
        | null;
      if (!response.ok) {
        if (payload?.missingFields?.length) {
          throw new Error(`Complete these fields before publish: ${payload.missingFields.join(", ")}`);
        }
        throw new Error(payload?.error || "Unable to save request");
      }

      const nextId = payload?.item?.id ?? initialRequest?.id;
      if (!nextId) {
        throw new Error("Saved request is missing an id");
      }

      router.push(`/requests/${nextId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save request");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <form
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="property-request-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit("save");
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Intent</span>
          <Select
            value={form.intent}
            onChange={(event) =>
              setForm((current) => ({ ...current, intent: event.target.value as PropertyRequestIntent }))
            }
          >
            <option value="rent">Rent</option>
            <option value="buy">Buy</option>
            <option value="shortlet">Shortlet</option>
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Market</span>
          <Select value={form.marketCode} onChange={(event) => handleMarketChange(event.target.value)}>
            {marketOptions.map((option) => (
              <option key={option.country} value={option.country}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">City</span>
          <Input
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            placeholder="Lagos"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Area</span>
          <Input
            value={form.area}
            onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))}
            placeholder="Lekki Phase 1"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Location details</span>
        <Input
          value={form.locationText}
          onChange={(event) =>
            setForm((current) => ({ ...current, locationText: event.target.value }))
          }
          placeholder="Close to Admiralty Way, walkable to offices"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Budget min ({form.currencyCode})</span>
          <Input
            inputMode="numeric"
            value={form.budgetMin}
            onChange={(event) =>
              setForm((current) => ({ ...current, budgetMin: event.target.value }))
            }
            placeholder="100000"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Budget max ({form.currencyCode})</span>
          <Input
            inputMode="numeric"
            value={form.budgetMax}
            onChange={(event) =>
              setForm((current) => ({ ...current, budgetMax: event.target.value }))
            }
            placeholder="300000"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Property type</span>
          <Select
            value={form.propertyType}
            onChange={(event) =>
              setForm((current) => ({ ...current, propertyType: event.target.value }))
            }
          >
            {PROPERTY_REQUEST_PROPERTY_TYPE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Bedrooms</span>
          <Select
            value={form.bedrooms}
            onChange={(event) => setForm((current) => ({ ...current, bedrooms: event.target.value }))}
          >
            {PROPERTY_REQUEST_BEDROOM_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Bathrooms</span>
          <Input
            inputMode="numeric"
            value={form.bathrooms}
            onChange={(event) =>
              setForm((current) => ({ ...current, bathrooms: event.target.value }))
            }
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Move timeline</span>
          <Select
            value={form.moveTimeline}
            onChange={(event) =>
              setForm((current) => ({ ...current, moveTimeline: event.target.value }))
            }
          >
            {PROPERTY_REQUEST_MOVE_TIMELINE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Furnished</span>
          <Select
            value={form.furnished}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                furnished: event.target.value as FormState["furnished"],
              }))
            }
          >
            <option value="">No preference</option>
            <option value="true">Furnished</option>
            <option value="false">Unfurnished</option>
          </Select>
        </label>
      </div>

      {isShortlet ? (
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Shortlet duration</span>
          <Input
            value={form.shortletDuration}
            onChange={(event) =>
              setForm((current) => ({ ...current, shortletDuration: event.target.value }))
            }
            placeholder="2 weeks"
          />
        </label>
      ) : null}

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Special requirements</span>
        <Textarea
          rows={5}
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Parking, proximity to schools, gated compound, flexible payment terms"
        />
      </label>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3" data-testid="property-request-form-actions">
        <Button type="submit" variant="secondary" disabled={pendingAction !== null}>
          {pendingAction === "save" || pendingAction === "draft" ? "Saving..." : saveActionLabel}
        </Button>
        {currentStatus !== "open" ? (
          <Button
            type="button"
            onClick={() => void submit("open")}
            disabled={pendingAction !== null}
          >
            {pendingAction === "open" ? "Publishing..." : "Publish request"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
