export type CurrencyMinorTotals = Record<string, number>;

function normalizeCurrencyCode(input: string | null | undefined) {
  const normalized = String(input || "").trim().toUpperCase();
  return normalized || "NGN";
}

function toSafeMinor(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const minor = Math.trunc(numeric);
  return minor > 0 ? minor : 0;
}

export function groupMoneyByCurrency<T extends { currency?: string | null }>(
  rows: T[],
  amountAccessor: (row: T) => number
): CurrencyMinorTotals {
  const totals: CurrencyMinorTotals = {};
  for (const row of rows) {
    const amountMinor = toSafeMinor(amountAccessor(row));
    if (amountMinor <= 0) continue;
    const currency = normalizeCurrencyCode(row.currency);
    totals[currency] = (totals[currency] || 0) + amountMinor;
  }
  return totals;
}

export function sortCurrencyMinorTotals(
  totals: CurrencyMinorTotals,
  options?: { preferredCurrency?: string | null }
) {
  const preferred =
    typeof options?.preferredCurrency === "string" && options.preferredCurrency.trim().length
      ? normalizeCurrencyCode(options.preferredCurrency)
      : null;
  return Object.entries(totals)
    .filter((entry) => entry[1] > 0)
    .sort((a, b) => {
      const aPreferred = preferred ? a[0] === preferred : false;
      const bPreferred = preferred ? b[0] === preferred : false;
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      return a[0].localeCompare(b[0]);
    });
}

export function formatCurrencyMinor(
  currency: string,
  amountMinor: number,
  options?: { locale?: string }
) {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  const normalizedCurrency = normalizeCurrencyCode(currency);
  try {
    return new Intl.NumberFormat(options?.locale || "en-NG", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${normalizedCurrency} ${amount.toFixed(2)}`;
  }
}

export function formatMultiCurrencyTotal(
  totals: CurrencyMinorTotals,
  options?: {
    preferredCurrency?: string | null;
    locale?: string;
    separator?: string;
    fallbackCurrency?: string;
  }
) {
  const entries = sortCurrencyMinorTotals(totals, {
    preferredCurrency: options?.preferredCurrency,
  });
  if (!entries.length) {
    return formatCurrencyMinor(options?.fallbackCurrency || "NGN", 0, {
      locale: options?.locale,
    });
  }
  return entries
    .map((entry) => formatCurrencyMinor(entry[0], entry[1], { locale: options?.locale }))
    .join(options?.separator || " + ");
}
