import { SHORTLET_PLACE_SEED, type PlaceSeedEntry } from "@/lib/places/places.seed";

export type PlaceSuggestion = {
  label: string;
  subtitle?: string;
  countryCode?: string;
  marketHint?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  bbox?: string;
};

export type PlaceSuggestionInput = {
  q: string;
  market?: string | null;
  limit?: number;
};

function normalizeMarket(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function matchStrength(entry: PlaceSeedEntry, q: string): number {
  const needle = q.trim().toLowerCase();
  if (!needle) return 0;

  const targets = [entry.label, entry.subtitle, ...(entry.aliases ?? [])]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);

  let score = 0;
  for (const target of targets) {
    if (target === needle) {
      score = Math.max(score, 120);
      continue;
    }
    if (target.startsWith(needle)) {
      score = Math.max(score, 100);
      continue;
    }
    if (target.includes(needle)) {
      score = Math.max(score, 70);
    }
  }
  return score;
}

function scoreEntry(entry: PlaceSeedEntry, input: PlaceSuggestionInput): number {
  const market = normalizeMarket(input.market);
  const strength = matchStrength(entry, input.q);
  if (strength <= 0) return -1;

  let score = 0;
  const popularity = Number.isFinite(entry.popularity) ? Number(entry.popularity) : 0;
  // Keep suggestions relevant, but prioritize popular hubs once a match exists.
  score += Math.min(220, Math.max(0, popularity * 2));
  score += Math.min(60, strength);

  if (entry.countryCode === "NG") {
    score += market === "NG" ? 30 : 14;
  } else if (market && entry.countryCode === market) {
    score += 16;
  } else if (!market) {
    score += 2;
  }

  return score;
}

function toSuggestion(entry: PlaceSeedEntry): PlaceSuggestion {
  return {
    label: entry.label,
    subtitle: entry.subtitle,
    countryCode: entry.countryCode,
    marketHint: entry.marketHint,
    placeId: entry.placeId,
    lat: entry.latitude,
    lng: entry.longitude,
    bbox: entry.bbox,
  };
}

export function getPlaceSuggestions(input: PlaceSuggestionInput): PlaceSuggestion[] {
  const limit = Math.max(1, Math.min(12, Number(input.limit) || 8));
  const needle = String(input.q || "").trim();
  if (!needle) return [];

  const ranked = SHORTLET_PLACE_SEED.map((entry) => ({
    entry,
    score: scoreEntry(entry, input),
  }))
    .filter((row) => row.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.entry.label.localeCompare(right.entry.label);
    })
    .slice(0, limit);

  return ranked.map((row) => toSuggestion(row.entry));
}
