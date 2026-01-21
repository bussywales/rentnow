import type { Property } from "@/lib/types";

const NON_ALPHANUMERIC = /[^a-zA-Z0-9]+/g;

export type LocationQueryInfo = {
  tokens: string[];
  postalPrefix?: string;
  countryHint?: string;
};

function normalizeToken(value: string) {
  return value.replace(NON_ALPHANUMERIC, "").toLowerCase();
}

function tokenize(value: string | null | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(NON_ALPHANUMERIC)
        .map((token) => normalizeToken(token))
        .filter(Boolean)
    )
  );
}

function normalizePostal(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[\s-]/g, "").toUpperCase();
  return normalized.length ? normalized : null;
}

function detectGbPrefix(input: string): string | null {
  const match = input.match(/\b([A-Z]{1,2}\d[A-Z\d]?)(?:\s*\d[A-Z]{2})?\b/);
  return match?.[1] ?? null;
}

function detectUsPrefix(input: string): string | null {
  const matchFive = input.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (matchFive?.[1]) return matchFive[1];
  const matchThree = input.match(/\b(\d{3})\b/);
  return matchThree?.[1] ?? null;
}

function detectCaPrefix(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "");
  const longMatch = compact.match(/([A-Z]\d[A-Z])\d[A-Z]\d/);
  if (longMatch?.[1]) return longMatch[1];
  const shortMatch = input.match(/\b([A-Z]\d[A-Z])\b/);
  return shortMatch?.[1] ?? null;
}

export function extractLocationQuery(q: string): LocationQueryInfo {
  const trimmed = q.trim();
  if (!trimmed) return { tokens: [] };

  const upper = trimmed.toUpperCase();
  const gb = detectGbPrefix(upper);
  const us = detectUsPrefix(upper);
  const ca = detectCaPrefix(upper);
  const postalPrefix = gb || us || ca || undefined;
  const countryHint = gb ? "GB" : us ? "US" : ca ? "CA" : undefined;

  return {
    tokens: tokenize(trimmed),
    postalPrefix,
    countryHint,
  };
}

type LocationComparable = Pick<
  Property,
  "postal_code" | "admin_area_2" | "admin_area_1" | "city" | "country_code"
>;

export function computeLocationScore(
  property: LocationComparable,
  queryInfo: LocationQueryInfo
): number {
  if (!queryInfo.tokens.length && !queryInfo.postalPrefix) return 0;

  let score = 0;
  const normalizedPrefix = normalizePostal(queryInfo.postalPrefix);
  const postalCode = normalizePostal(property.postal_code);
  if (normalizedPrefix && postalCode?.startsWith(normalizedPrefix)) {
    score += 100;
  }

  const queryTokens = new Set(queryInfo.tokens.map((token) => normalizeToken(token)));

  const matchesToken = (value: string | null | undefined) => {
    if (!value || !queryTokens.size) return false;
    const tokens = tokenize(value);
    return tokens.some((token) => queryTokens.has(token));
  };

  if (matchesToken(property.admin_area_2)) {
    score += 40;
  }
  if (matchesToken(property.admin_area_1)) {
    score += 25;
  }
  if (matchesToken(property.city)) {
    score += 20;
  }
  if (matchesToken(property.country_code)) {
    score += 10;
  }
  const normalizedCountryHint = queryInfo.countryHint?.toUpperCase();
  const normalizedPropertyCountry = property.country_code?.toUpperCase();
  if (normalizedCountryHint && normalizedPropertyCountry) {
    if (normalizedCountryHint === normalizedPropertyCountry) {
      score += 10;
    } else {
      score -= 5;
    }
  }

  return score;
}
