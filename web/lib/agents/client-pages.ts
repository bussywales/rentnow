import { safeTrim, slugifyAgentName, ensureUniqueSlug } from "@/lib/agents/agent-storefront";

export type ClientPageCriteria = {
  intent: "rent" | "buy" | null;
  city: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  listingType: string | null;
};

export type ClientPagePublicState<T> = {
  ok: boolean;
  listings: T[];
};

export function normalizeClientPageCriteria(input: unknown): ClientPageCriteria {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const intentValue = safeTrim(raw.intent);
  const intent = intentValue === "rent" || intentValue === "buy" ? intentValue : null;

  const city = safeTrim(raw.city) || null;
  const listingType = safeTrim(raw.listingType) || null;

  const parseNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  return {
    intent,
    city,
    minPrice: parseNumber(raw.minPrice),
    maxPrice: parseNumber(raw.maxPrice),
    bedrooms: parseNumber(raw.bedrooms),
    listingType,
  };
}

export function serializeClientPageCriteria(criteria: ClientPageCriteria) {
  return {
    intent: criteria.intent,
    city: criteria.city,
    minPrice: criteria.minPrice,
    maxPrice: criteria.maxPrice,
    bedrooms: criteria.bedrooms,
    listingType: criteria.listingType,
  };
}

export function buildClientSlug(clientName: string, existing: string[]): string {
  const base = slugifyAgentName(clientName) || "client";
  return ensureUniqueSlug(base, existing);
}

export function resolveClientPagePublicState<T extends { status?: string | null }>(input: {
  published: boolean;
  listings: T[];
}): ClientPagePublicState<T> {
  if (!input.published) return { ok: false, listings: [] };
  const liveOnly = input.listings.filter((listing) => listing.status === "live");
  return { ok: true, listings: liveOnly };
}
