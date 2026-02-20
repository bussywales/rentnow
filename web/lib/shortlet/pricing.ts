export type ShortletFeePolicy = {
  serviceFeePct?: number | null;
  cleaningFee?: number | null;
  taxPct?: number | null;
};

export type ShortletCalculatedFees = {
  serviceFee: number;
  cleaningFee: number;
  taxes: number;
  total: number;
};

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function normalizeAmount(value: number | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function normalizePct(value: number | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function parseDateKey(value: string | null | undefined): Date | null {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime())) return null;
  return date;
}

export function calcNights(checkIn: string | null | undefined, checkOut: string | null | undefined): number {
  const from = parseDateKey(checkIn);
  const to = parseDateKey(checkOut);
  if (!from || !to) return 0;
  const diffMs = to.getTime() - from.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function calcSubtotal(nights: number | null | undefined, nightly: number | null | undefined): number {
  const normalizedNights = Number.isFinite(Number(nights)) ? Math.max(0, Math.trunc(Number(nights))) : 0;
  const normalizedNightly = normalizeAmount(nightly);
  if (normalizedNights <= 0 || normalizedNightly <= 0) return 0;
  return roundMoney(normalizedNights * normalizedNightly);
}

export function calcFees(input: {
  subtotal: number | null | undefined;
  feePolicy?: ShortletFeePolicy | null;
}): ShortletCalculatedFees {
  const subtotal = normalizeAmount(input.subtotal);
  const serviceFeePct = normalizePct(input.feePolicy?.serviceFeePct);
  const taxPct = normalizePct(input.feePolicy?.taxPct);
  const cleaningFee = roundMoney(normalizeAmount(input.feePolicy?.cleaningFee));
  const serviceFee = roundMoney((subtotal * serviceFeePct) / 100);
  const taxes = roundMoney((subtotal * taxPct) / 100);
  const total = roundMoney(subtotal + serviceFee + cleaningFee + taxes);
  return {
    serviceFee,
    cleaningFee,
    taxes,
    total,
  };
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  const normalizedAmount = roundMoney(normalizeAmount(amount));
  const normalizedCurrency = String(currency || "NGN").trim().toUpperCase() || "NGN";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: normalizedAmount % 1 === 0 ? 0 : 2,
      minimumFractionDigits: normalizedAmount % 1 === 0 ? 0 : 2,
    }).format(normalizedAmount);
  } catch {
    return `${normalizedCurrency} ${normalizedAmount.toFixed(2)}`;
  }
}
