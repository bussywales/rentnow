import type { Property } from "@/lib/types";

export type PropertyDetailFetchResult = {
  property: Property | null;
  error: string | null;
  apiUrl: string | null;
};

export function shouldAttemptPropertyDetailFallback(error: string | null | undefined) {
  const normalized = String(error || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("invalid property id")) return false;
  if (normalized.includes("property not found")) return true;
  if (normalized.includes("api responded with")) return true;
  if (normalized.includes("failed to fetch")) return true;
  if (normalized.includes("network")) return true;
  if (normalized.includes("econnrefused")) return true;
  if (normalized.includes("enotfound")) return true;
  if (normalized.includes("eai_again")) return true;
  return false;
}

export async function resolvePropertyDetailWithFallback(input: {
  primary: () => Promise<PropertyDetailFetchResult>;
  fallback: () => Promise<Property | null>;
  shouldFallback?: (error: string | null | undefined) => boolean;
}): Promise<PropertyDetailFetchResult & { usedFallback: boolean }> {
  const primaryResult = await input.primary();
  if (primaryResult.property) {
    return { ...primaryResult, usedFallback: false };
  }

  const evaluateFallback =
    input.shouldFallback ?? shouldAttemptPropertyDetailFallback;
  if (!evaluateFallback(primaryResult.error)) {
    return { ...primaryResult, usedFallback: false };
  }

  const fallbackProperty = await input.fallback();
  if (!fallbackProperty) {
    return { ...primaryResult, usedFallback: false };
  }

  return {
    property: fallbackProperty,
    error: null,
    apiUrl: primaryResult.apiUrl,
    usedFallback: true,
  };
}
