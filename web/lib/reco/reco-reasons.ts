import { MARKET_OPTIONS } from "@/lib/market/market";
import type { RecoReasonCode } from "@/lib/reco/reco-schema";

const FALLBACK_MARKET_LABEL = "your market";

const RECO_REASON_COPY: Record<Exclude<RecoReasonCode, "FALLBACK_POPULAR">, string> = {
  SAVED: "Because you saved similar homes",
  VIEWED: "Because you viewed similar homes",
  CONTINUE_BROWSING: "Continue browsing this search",
};

function normalizeMarketCountry(input: string | null | undefined): string {
  const normalized = String(input ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "UK") return "GB";
  return normalized;
}

function resolveMarketLabel(countryCode: string | null | undefined): string {
  const normalized = normalizeMarketCountry(countryCode);
  const option = MARKET_OPTIONS.find((entry) => normalizeMarketCountry(entry.country) === normalized);
  if (!option) return FALLBACK_MARKET_LABEL;
  return option.label;
}

export function resolveRecoReasonLabel(input: {
  code: RecoReasonCode;
  marketCountry?: string | null;
}): string {
  if (input.code === "FALLBACK_POPULAR") {
    return `Popular in ${resolveMarketLabel(input.marketCountry)}`;
  }
  return RECO_REASON_COPY[input.code];
}

export const RECO_WHY_COPY =
  "These picks are based on your saved items, recently viewed, and last browsing — stored locally on this device.";
