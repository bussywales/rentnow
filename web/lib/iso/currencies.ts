import { CURRENCY_CODES } from "@/lib/currencies";

export type IsoCurrency = {
  code: string;
  name: string;
};

type CurrencyDisplayNames = {
  of: (code: string) => string | undefined;
};

type CurrencyDisplayNamesCtor = new (
  locales: string | string[],
  options: { type: "currency" }
) => CurrencyDisplayNames;

function getCurrencyDisplayNames(): CurrencyDisplayNames | null {
  if (typeof Intl === "undefined") return null;
  const DisplayNames = (Intl as unknown as { DisplayNames?: CurrencyDisplayNamesCtor })
    .DisplayNames;
  if (!DisplayNames) return null;
  try {
    return new DisplayNames(["en"], { type: "currency" });
  } catch {
    return null;
  }
}

const DISPLAY_NAMES = getCurrencyDisplayNames();

export const ISO_CURRENCIES: IsoCurrency[] = CURRENCY_CODES.map((code) => ({
  code: code.toUpperCase(),
  name: DISPLAY_NAMES?.of(code) ?? code.toUpperCase(),
}));

const ISO_CURRENCY_BY_CODE = new Map(
  ISO_CURRENCIES.map((currency) => [currency.code, currency])
);

export function normalizeIsoCurrencyCode(value: string | null | undefined): string {
  return String(value || "").trim().toUpperCase();
}

export function findIsoCurrencyByCode(value: string | null | undefined): IsoCurrency | null {
  const code = normalizeIsoCurrencyCode(value);
  if (!code) return null;
  return ISO_CURRENCY_BY_CODE.get(code) ?? null;
}

export function formatIsoCurrencyLabel(currency: Pick<IsoCurrency, "name" | "code">): string {
  return `${currency.name} (${currency.code})`;
}
