export type FxRates = Record<string, number>;

export type FxSnapshot = {
  date: string;
  baseCurrency: string;
  rates: FxRates;
  source: string;
  fetchedAt?: string | null;
};

export type FxMoneyMinor = {
  amountMinor: number;
  currency: string;
};

type RoundingMode = "round" | "floor" | "ceil";

function normalizeCurrencyCode(input: string | null | undefined) {
  const normalized = String(input || "").trim().toUpperCase();
  return normalized || null;
}

function normalizeAmountMinor(input: number) {
  if (!Number.isFinite(input)) return null;
  return Math.trunc(input);
}

function toSafeRate(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= 0) return null;
  return numeric;
}

function resolveRounding(mode?: RoundingMode) {
  if (mode === "floor") return Math.floor;
  if (mode === "ceil") return Math.ceil;
  return Math.round;
}

function resolveRate(snapshot: FxSnapshot, currency: string) {
  const normalized = normalizeCurrencyCode(currency);
  if (!normalized) return null;
  if (normalized === snapshot.baseCurrency) return 1;
  return toSafeRate(snapshot.rates[normalized]);
}

export function createFxSnapshot(input: {
  date: string;
  baseCurrency: string;
  rates: FxRates;
  source: string;
  fetchedAt?: string | null;
}): FxSnapshot | null {
  const baseCurrency = normalizeCurrencyCode(input.baseCurrency);
  const source = String(input.source || "").trim();
  const date = String(input.date || "").trim();
  if (!baseCurrency || !source || !date) return null;

  const normalizedRates: FxRates = {};
  for (const [currency, value] of Object.entries(input.rates || {})) {
    const normalizedCurrency = normalizeCurrencyCode(currency);
    const safeRate = toSafeRate(value);
    if (!normalizedCurrency || !safeRate) continue;
    normalizedRates[normalizedCurrency] = safeRate;
  }

  return {
    date,
    baseCurrency,
    rates: normalizedRates,
    source,
    fetchedAt: input.fetchedAt ?? null,
  };
}

export function convertMinor(input: {
  amountMinor: number;
  from: string;
  to: string;
  snapshot: FxSnapshot;
  rounding?: RoundingMode;
}): number | null {
  const amountMinor = normalizeAmountMinor(input.amountMinor);
  const from = normalizeCurrencyCode(input.from);
  const to = normalizeCurrencyCode(input.to);
  if (amountMinor === null || !from || !to) return null;
  if (amountMinor === 0) return 0;
  if (from === to) return amountMinor;

  const fromRate = resolveRate(input.snapshot, from);
  const toRate = resolveRate(input.snapshot, to);
  if (!fromRate || !toRate) return null;

  const amountMajor = amountMinor / 100;
  const baseMajor = amountMajor / fromRate;
  const toMajor = baseMajor * toRate;
  const round = resolveRounding(input.rounding);
  return round(toMajor * 100);
}

export function sumToCurrencyMinor(input: {
  rows: FxMoneyMinor[];
  to: string;
  snapshot: FxSnapshot;
  rounding?: RoundingMode;
}): number | null {
  let totalMinor = 0;
  for (const row of input.rows) {
    const converted = convertMinor({
      amountMinor: row.amountMinor,
      from: row.currency,
      to: input.to,
      snapshot: input.snapshot,
      rounding: input.rounding,
    });
    if (converted === null) return null;
    totalMinor += converted;
  }
  return totalMinor;
}
