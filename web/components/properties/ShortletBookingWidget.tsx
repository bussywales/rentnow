"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/calendar";
import { resolveShortletBookingCtaLabel } from "@/lib/shortlet/booking-cta";
import {
  expandRangesToDisabledDates,
  toDateKey,
  type ShortletRangeValidationReason,
  type ShortletUnavailableRange,
  validateRangeSelection,
} from "@/lib/shortlet/availability";

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

type CalendarAvailabilityResponse = {
  ok: boolean;
  listingId: string;
  from: string;
  to: string;
  blockedRanges: Array<{ start: string; end: string; source: string }>;
  bookedRanges: Array<{ start: string; end: string; bookingId?: string | null }>;
  timezone?: string | null;
};

type CalendarWindow = {
  monthKey: string;
  from: string;
  to: string;
};

const AVAILABILITY_WINDOW_DAYS = 180;
const CALENDAR_DISABLED_HORIZON_DAYS = 720;
const availabilityWindowCache = new Map<string, CalendarAvailabilityResponse>();
const availabilityConflictCode = "availability_conflict";

type BookingCreateResponse = {
  booking?: { id?: string; status?: string };
  error?: string;
  code?: string;
  conflicting_dates?: string[];
  conflicting_ranges?: Array<{
    start: string;
    end: string;
    source?: string | null;
    bookingId?: string | null;
  }>;
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

function formatDisplayDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  const nextYear = utc.getUTCFullYear();
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(utc.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function buildCalendarWindow(month: Date): CalendarWindow {
  const monthStart = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
  const from = toDateKey(new Date(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), monthStart.getUTCDate()));
  const to = addDaysToDateKey(from, AVAILABILITY_WINDOW_DAYS);
  return {
    monthKey: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
    from,
    to,
  };
}

function dedupeUnavailableRanges(
  previous: ReadonlyArray<ShortletUnavailableRange>,
  incoming: ReadonlyArray<ShortletUnavailableRange>
): ShortletUnavailableRange[] {
  const map = new Map<string, ShortletUnavailableRange>();
  for (const row of previous) {
    const key = `${row.start}:${row.end}:${row.source ?? ""}:${row.bookingId ?? ""}`;
    map.set(key, row);
  }
  for (const row of incoming) {
    const key = `${row.start}:${row.end}:${row.source ?? ""}:${row.bookingId ?? ""}`;
    map.set(key, row);
  }
  return Array.from(map.values());
}

export function resolveRangeHint(
  reason: ShortletRangeValidationReason | null,
  options: { minNights: number; maxNights: number | null }
): string | null {
  if (!reason) return null;
  if (reason === "includes_unavailable_night") {
    return "Those dates include unavailable nights. Choose different dates.";
  }
  if (reason === "min_nights") {
    return `Minimum stay is ${options.minNights} night${options.minNights === 1 ? "" : "s"}.`;
  }
  if (reason === "max_nights" && options.maxNights && options.maxNights > 0) {
    return `Maximum stay is ${options.maxNights} night${options.maxNights === 1 ? "" : "s"}.`;
  }
  if (reason === "checkout_before_checkin") {
    return "Check-out must be after check-in.";
  }
  return null;
}

export function canContinueToPayment(input: {
  hasNightlyPriceConfigured: boolean;
  hasPricing: boolean;
  isRangeValid: boolean;
  loading: boolean;
}): boolean {
  return (
    input.hasNightlyPriceConfigured &&
    input.hasPricing &&
    input.isRangeValid &&
    !input.loading
  );
}

export type ShortletCalendarOverlayState = {
  calendarOpen: boolean;
  draftRange: DateRange | undefined;
};

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function cloneRange(value: DateRange | undefined): DateRange | undefined {
  if (!value?.from) return undefined;
  return {
    from: cloneDate(value.from),
    to: value.to ? cloneDate(value.to) : undefined,
  };
}

export function openShortletCalendarOverlay(selectedRange: DateRange | undefined): ShortletCalendarOverlayState {
  return {
    calendarOpen: true,
    draftRange: cloneRange(selectedRange),
  };
}

export function closeShortletCalendarOverlay(draftRange: DateRange | undefined): ShortletCalendarOverlayState {
  return {
    calendarOpen: false,
    draftRange: cloneRange(draftRange),
  };
}

export function applyShortletDraftRange(draftRange: DateRange | undefined): {
  selectedRange: DateRange;
  checkIn: string;
  checkOut: string;
} | null {
  if (!draftRange?.from || !draftRange.to) return null;
  return {
    selectedRange: {
      from: cloneDate(draftRange.from),
      to: cloneDate(draftRange.to),
    },
    checkIn: toDateKey(draftRange.from),
    checkOut: toDateKey(draftRange.to),
  };
}

export function clearShortletDateRangeState() {
  return {
    selectedRange: undefined,
    draftRange: undefined,
    checkIn: "",
    checkOut: "",
  } as const;
}

export function ShortletBookingWidget(props: {
  propertyId: string;
  listingTitle: string;
  isAuthenticated: boolean;
  loginHref: string;
}) {
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isMobileCalendar, setIsMobileCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);
  const [checkIn, setCheckIn] = useState<string>("");
  const [checkOut, setCheckOut] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [unavailableRanges, setUnavailableRanges] = useState<ShortletUnavailableRange[]>([]);
  const [conflictingDates, setConflictingDates] = useState<string[]>([]);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const loadedWindowKeysRef = useRef<Set<string>>(new Set());

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const todayDateKey = useMemo(() => toDateKey(today), [today]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobileCalendar(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!calendarOpen || !isMobileCalendar) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [calendarOpen, isMobileCalendar]);

  const minNights = availability?.settings?.minNights ?? 1;
  const maxNights = availability?.settings?.maxNights ?? null;

  const disabledSet = useMemo(
    () =>
      expandRangesToDisabledDates(
        unavailableRanges,
        todayDateKey,
        addDaysToDateKey(todayDateKey, CALENDAR_DISABLED_HORIZON_DAYS)
      ),
    [todayDateKey, unavailableRanges]
  );

  const currentValidation = useMemo(
    () =>
      validateRangeSelection({
        checkIn,
        checkOut,
        disabledSet,
        minNights,
        maxNights,
      }),
    [checkIn, checkOut, disabledSet, minNights, maxNights]
  );

  const loadingAny = loading || metaLoading || calendarLoading;

  const loadAvailabilityWindow = useCallback(
    async (month: Date, options?: { force?: boolean }) => {
      const window = buildCalendarWindow(month);
      const cacheKey = `${props.propertyId}:${window.monthKey}`;
      if (options?.force) {
        loadedWindowKeysRef.current.delete(cacheKey);
        availabilityWindowCache.delete(cacheKey);
      }
      if (loadedWindowKeysRef.current.has(cacheKey)) {
        return;
      }

      const cached = availabilityWindowCache.get(cacheKey);
      if (cached) {
        loadedWindowKeysRef.current.add(cacheKey);
        const mapped: ShortletUnavailableRange[] = [
          ...cached.blockedRanges.map((row) => ({
            start: row.start,
            end: row.end,
            source: row.source,
          })),
          ...cached.bookedRanges.map((row) => ({
            start: row.start,
            end: row.end,
            source: "booking",
            bookingId: row.bookingId ?? null,
          })),
        ];
        setUnavailableRanges((previous) => dedupeUnavailableRanges(previous, mapped));
        return;
      }

      setCalendarLoading(true);
      try {
        const response = await fetch(
          `/api/shortlet/availability?listingId=${encodeURIComponent(props.propertyId)}&from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`,
          {
            credentials: "include",
          }
        );
        const payload = (await response.json().catch(() => null)) as CalendarAvailabilityResponse | null;
        if (!response.ok || !payload?.ok) {
          throw new Error("Unable to load calendar availability");
        }

        availabilityWindowCache.set(cacheKey, payload);
        loadedWindowKeysRef.current.add(cacheKey);
        const mapped: ShortletUnavailableRange[] = [
          ...payload.blockedRanges.map((row) => ({
            start: row.start,
            end: row.end,
            source: row.source,
          })),
          ...payload.bookedRanges.map((row) => ({
            start: row.start,
            end: row.end,
            source: "booking",
            bookingId: row.bookingId ?? null,
          })),
        ];
        setUnavailableRanges((previous) => dedupeUnavailableRanges(previous, mapped));
      } catch (windowError) {
        setError(windowError instanceof Error ? windowError.message : "Unable to load calendar availability");
      } finally {
        setCalendarLoading(false);
      }
    },
    [props.propertyId]
  );

  const prefetchAvailabilityMonths = useCallback(
    async (baseMonth: Date, options?: { force?: boolean }) => {
      const monthStart = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
      const nextMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
      await Promise.all([
        loadAvailabilityWindow(monthStart, options),
        loadAvailabilityWindow(nextMonth, options),
      ]);
    },
    [loadAvailabilityWindow]
  );

  useEffect(() => {
    void prefetchAvailabilityMonths(new Date());
  }, [prefetchAvailabilityMonths]);

  useEffect(() => {
    if (!calendarOpen) return;
    void prefetchAvailabilityMonths(calendarMonth);
  }, [calendarMonth, calendarOpen, prefetchAvailabilityMonths]);

  useEffect(() => {
    let active = true;
    const loadMeta = async () => {
      setMetaLoading(true);
      try {
        const response = await fetch(`/api/properties/${encodeURIComponent(props.propertyId)}/availability`, {
          credentials: "include",
        });
        const payload = (await response.json().catch(() => null)) as AvailabilityResponse | null;
        if (!response.ok || !payload) {
          throw new Error("Unable to load booking settings");
        }
        if (active) {
          setAvailability(payload);
        }
      } catch (metaError) {
        if (active) {
          setAvailability(null);
          setError(metaError instanceof Error ? metaError.message : "Unable to load booking settings");
        }
      } finally {
        if (active) {
          setMetaLoading(false);
        }
      }
    };

    void loadMeta();
    return () => {
      active = false;
    };
  }, [props.propertyId]);

  useEffect(() => {
    let active = true;
    const loadPricing = async () => {
      if (!checkIn || !checkOut || !currentValidation.valid) {
        setAvailability((previous) =>
          previous
            ? {
                ...previous,
                pricing: null,
              }
            : previous
        );
        return;
      }

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
          throw new Error("Unable to load pricing for selected dates");
        }
        if (active) {
          setAvailability((previous) => ({
            ...(previous ?? payload),
            ...payload,
            settings: payload.settings ?? previous?.settings ?? null,
            bookingMode: payload.bookingMode ?? previous?.bookingMode ?? "request",
          }));
        }
      } catch (loadError) {
        if (active) {
          setAvailability((previous) =>
            previous
              ? {
                  ...previous,
                  pricing: null,
                }
              : previous
          );
          setError(loadError instanceof Error ? loadError.message : "Unable to load pricing for selected dates");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPricing();
    return () => {
      active = false;
    };
  }, [checkIn, checkOut, currentValidation.valid, props.propertyId]);

  const bookingMode = availability?.bookingMode ?? "request";
  const isRequestMode = bookingMode === "request";
  const modeCtaLabel = resolveShortletBookingCtaLabel(bookingMode);
  const ctaLabel = "Continue to payment";
  const pricing = availability?.pricing ?? null;
  const hasNightlyPriceConfigured =
    typeof availability?.settings?.nightlyPriceMinor === "number" &&
    availability.settings.nightlyPriceMinor > 0;
  const canSubmit = canContinueToPayment({
    hasNightlyPriceConfigured,
    hasPricing: !!pricing,
    isRangeValid: currentValidation.valid,
    loading: loadingAny,
  });

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

  const disabledDaysMatcher = useMemo(
    () => [
      { before: today },
      (date: Date) => disabledSet.has(toDateKey(date)),
    ],
    [disabledSet, today]
  );
  const conflictingDateSet = useMemo(() => new Set(conflictingDates), [conflictingDates]);
  const draftValidation = useMemo(() => {
    if (!draftRange?.from || !draftRange.to) {
      return { valid: false, reason: null as ShortletRangeValidationReason | null };
    }
    return validateRangeSelection({
      checkIn: toDateKey(draftRange.from),
      checkOut: toDateKey(draftRange.to),
      disabledSet,
      minNights,
      maxNights,
    });
  }, [disabledSet, draftRange, maxNights, minNights]);

  const openCalendarPicker = useCallback(() => {
    const nextState = openShortletCalendarOverlay(selectedRange);
    setCalendarOpen(nextState.calendarOpen);
    setDraftRange(nextState.draftRange);
    setError(null);
    setNotice(null);
    setAvailabilityNotice(null);
    setSelectionHint(null);
    setConflictingDates([]);
  }, [selectedRange]);

  const closeCalendarPicker = useCallback(() => {
    const nextState = closeShortletCalendarOverlay(draftRange);
    setCalendarOpen(nextState.calendarOpen);
    setDraftRange(nextState.draftRange);
    setSelectionHint(null);
  }, [draftRange]);

  const onDraftRangeSelect = useCallback(
    (next: DateRange | undefined) => {
      setError(null);
      setNotice(null);
      setAvailabilityNotice(null);
      setConflictingDates([]);

      if (!next?.from) {
        setDraftRange(undefined);
        setSelectionHint(null);
        return;
      }

      const draft = {
        from: next.from,
        to: next.to,
      } satisfies DateRange;
      setDraftRange(draft);

      if (!next.to) {
        setSelectionHint(null);
        return;
      }

      const validation = validateRangeSelection({
        checkIn: toDateKey(next.from),
        checkOut: toDateKey(next.to),
        disabledSet,
        minNights,
        maxNights,
      });
      if (!validation.valid) {
        setSelectionHint(
          resolveRangeHint(validation.reason, {
            minNights,
            maxNights,
          }) ?? "Unavailable. Choose different dates."
        );
        return;
      }
      setSelectionHint(null);
    },
    [disabledSet, maxNights, minNights]
  );

  const applyDraftRangeSelection = useCallback(() => {
    const applied = applyShortletDraftRange(draftRange);
    if (!applied) {
      setSelectionHint("Choose both check-in and check-out dates.");
      return;
    }

    const validation = validateRangeSelection({
      checkIn: applied.checkIn,
      checkOut: applied.checkOut,
      disabledSet,
      minNights,
      maxNights,
    });
    if (!validation.valid) {
      setSelectionHint(
        resolveRangeHint(validation.reason, {
          minNights,
          maxNights,
        }) ?? "Unavailable. Choose different dates."
      );
      return;
    }

    setSelectedRange(applied.selectedRange);
    setCheckIn(applied.checkIn);
    setCheckOut(applied.checkOut);
    setSelectionHint(null);
    setAvailabilityNotice(null);
    closeCalendarPicker();
  }, [closeCalendarPicker, disabledSet, draftRange, maxNights, minNights]);

  const clearDateSelection = useCallback(() => {
    const cleared = clearShortletDateRangeState();
    setSelectedRange(cleared.selectedRange);
    setDraftRange(cleared.draftRange);
    setCheckIn(cleared.checkIn);
    setCheckOut(cleared.checkOut);
    setConflictingDates([]);
    setSelectionHint(null);
    setAvailabilityNotice(null);
    setError(null);
  }, []);

  async function handleCreateBooking() {
    if (!checkIn || !checkOut || creating || !currentValidation.valid) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    const payloadNights = pricing?.nights ?? currentValidation.nights ?? 1;
    const payloadGuests = 1;
    const payloadMode = bookingMode === "instant" ? "instant" : "request";
    try {
      const response = await fetch("/api/shortlet/bookings/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: props.propertyId,
          check_in: checkIn,
          check_out: checkOut,
          nights: payloadNights,
          guests: payloadGuests,
          mode: payloadMode,
          intent: "shortlet",
        }),
      });
      const payload = (await response.json().catch(() => null)) as BookingCreateResponse | null;
      if (!response.ok) {
        if (payload?.code === availabilityConflictCode) {
          const conflictDates = Array.isArray(payload.conflicting_dates)
            ? payload.conflicting_dates.filter((value) => typeof value === "string")
            : [];
          const conflictRanges = Array.isArray(payload.conflicting_ranges)
            ? payload.conflicting_ranges
                .filter((row): row is NonNullable<BookingCreateResponse["conflicting_ranges"]>[number] => !!row)
                .map((row) => ({
                  start: row.start,
                  end: row.end,
                  source: row.source ?? "booking",
                  bookingId: row.bookingId ?? null,
                }))
            : [];
          const nextOverlayState = openShortletCalendarOverlay(selectedRange);
          setCalendarOpen(nextOverlayState.calendarOpen);
          setDraftRange(nextOverlayState.draftRange);
          setConflictingDates(conflictDates);
          setAvailabilityNotice("Just booked — refreshed. Choose different dates.");
          setSelectionHint("Unavailable. Choose different dates.");
          await prefetchAvailabilityMonths(selectedRange?.from ?? calendarMonth, { force: true });
          if (conflictRanges.length > 0) {
            setUnavailableRanges((previous) => dedupeUnavailableRanges(previous, conflictRanges));
          }
          return;
        }
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

  const blockedCount = availability?.blockedRanges?.length ?? 0;
  const currentRangeHint =
    selectionHint ??
    resolveRangeHint(currentValidation.reason, {
      minNights,
      maxNights,
    });

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

      <div className="relative mt-3" data-testid="shortlet-calendar-shell">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Check in</span>
            <button
              type="button"
              onClick={openCalendarPicker}
              className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 px-3 text-left text-sm text-slate-700 hover:border-slate-400"
              data-testid="shortlet-checkin-trigger"
            >
              <span>{checkIn ? formatDisplayDate(checkIn) : "Select date"}</span>
              <span className="text-xs text-slate-400">Calendar</span>
            </button>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Check out</span>
            <button
              type="button"
              onClick={openCalendarPicker}
              className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 px-3 text-left text-sm text-slate-700 hover:border-slate-400"
              data-testid="shortlet-checkout-trigger"
            >
              <span>{checkOut ? formatDisplayDate(checkOut) : "Select date"}</span>
              <span className="text-xs text-slate-400">Calendar</span>
            </button>
          </label>
        </div>

        {calendarOpen ? (
          <>
            <button
              type="button"
              aria-label="Close date picker"
              onClick={closeCalendarPicker}
              className="fixed inset-0 z-40 bg-slate-900/25"
              data-testid="shortlet-calendar-overlay"
            />
            <div
              className={
                isMobileCalendar
                  ? "fixed inset-x-0 bottom-0 z-50 px-2 pb-2"
                  : "absolute left-0 right-0 top-full z-50 mt-2"
              }
              data-testid={isMobileCalendar ? "shortlet-calendar-sheet" : "shortlet-calendar-popover"}
            >
              <div
                className={
                  isMobileCalendar
                    ? "max-h-[82dvh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-3 shadow-2xl"
                    : "rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                }
              >
                {calendarLoading && unavailableRanges.length < 1 ? (
                  <div className="space-y-3 px-2 py-2" aria-hidden="true">
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 35 }).map((_, index) => (
                        <div key={`cal-skeleton-${index}`} className="h-8 w-full animate-pulse rounded bg-slate-200" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <Calendar
                    mode="range"
                    month={calendarMonth}
                    selected={draftRange}
                    onSelect={onDraftRangeSelect}
                    onMonthChange={setCalendarMonth}
                    disabled={disabledDaysMatcher}
                    modifiers={{
                      conflict: (date: Date) => conflictingDateSet.has(toDateKey(date)),
                    }}
                    modifiersClassNames={{
                      conflict: "bg-rose-100 text-rose-700 ring-1 ring-rose-200 font-semibold",
                    }}
                    classNames={{
                      month_caption: "mb-1 flex items-center justify-between gap-2",
                      nav: "inline-flex items-center gap-1",
                      button_previous:
                        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100",
                      button_next:
                        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100",
                    }}
                    excludeDisabled
                    numberOfMonths={1}
                    fixedWeeks
                    onDayClick={(_, modifiers) => {
                      if (modifiers.disabled) {
                        setSelectionHint("Unavailable. Choose different dates.");
                      }
                    }}
                  />
                )}
                <div className="mt-2 flex flex-wrap gap-2 px-1">
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Selected
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    Unavailable
                  </span>
                  {conflictingDates.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Just booked
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 px-1 text-xs text-slate-500">
                  Grey dates are unavailable because they are booked, blocked, or in the past.
                </p>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={clearDateSelection} disabled={!checkIn && !checkOut && !draftRange}>
                    Clear
                  </Button>
                  <Button
                    type="button"
                    onClick={applyDraftRangeSelection}
                    disabled={!draftRange?.from || !draftRange?.to || !draftValidation.valid}
                  >
                    Apply dates
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {availabilityNotice ? <p className="mt-2 text-xs text-amber-700">{availabilityNotice}</p> : null}
      {currentRangeHint ? <p className="mt-2 text-xs text-slate-500">{currentRangeHint}</p> : null}

      {loadingAny ? (
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
              <p className="text-xs text-slate-500">Deposit is included in total for this pilot.</p>
            </>
          ) : (
            <p>
              {hasNightlyPriceConfigured
                ? "Select your stay dates to see pricing."
                : "Nightly pricing is not configured for this shortlet yet."}
            </p>
          )}
          {blockedCount > 0 ? (
            <p className="text-xs text-slate-500">
              Calendar loaded with {blockedCount} blocked or booked range
              {blockedCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {props.isAuthenticated ? (
          <Button
            onClick={handleCreateBooking}
            disabled={creating || loadingAny || !checkIn || !checkOut || !canSubmit}
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
      {!checkIn || !checkOut ? (
        <p className="mt-2 text-xs text-slate-500">Select check-in and check-out dates to continue.</p>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">{modeCtaLabel} will be finalised after checkout.</p>

      {notice ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-emerald-700">
          <p>{notice}</p>
          <Link href="/trips" className="font-semibold text-emerald-800 underline underline-offset-2">
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
