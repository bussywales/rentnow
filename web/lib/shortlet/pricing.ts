export type ShortletPricingInput = {
  checkIn: string;
  checkOut: string;
  nightlyPriceMinor: number;
  cleaningFeeMinor?: number | null;
  depositMinor?: number | null;
};

export type ShortletPricingBreakdown = {
  nights: number;
  nightlyPriceMinor: number;
  subtotalMinor: number;
  cleaningFeeMinor: number;
  depositMinor: number;
  totalAmountMinor: number;
};

function parseDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("INVALID_DATE");
  }
  return parsed;
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const start = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);
  const diffMs = end.getTime() - start.getTime();
  const nights = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(nights) || nights < 1) {
    throw new Error("INVALID_NIGHTS");
  }
  return nights;
}

export function calculateShortletPricing(input: ShortletPricingInput): ShortletPricingBreakdown {
  const nights = calculateNights(input.checkIn, input.checkOut);
  const nightlyPriceMinor = Math.max(0, Math.trunc(input.nightlyPriceMinor || 0));
  const cleaningFeeMinor = Math.max(0, Math.trunc(input.cleaningFeeMinor || 0));
  const depositMinor = Math.max(0, Math.trunc(input.depositMinor || 0));
  const subtotalMinor = nightlyPriceMinor * nights;
  const totalAmountMinor = subtotalMinor + cleaningFeeMinor + depositMinor;

  return {
    nights,
    nightlyPriceMinor,
    subtotalMinor,
    cleaningFeeMinor,
    depositMinor,
    totalAmountMinor,
  };
}

export type DateRangeInput = {
  from: string;
  to: string;
};

export function hasDateOverlap(a: DateRangeInput, b: DateRangeInput): boolean {
  const aStart = parseDateOnly(a.from);
  const aEnd = parseDateOnly(a.to);
  const bStart = parseDateOnly(b.from);
  const bEnd = parseDateOnly(b.to);

  if (aEnd <= aStart || bEnd <= bStart) return false;

  // Half-open ranges [from, to)
  return aStart < bEnd && bStart < aEnd;
}
