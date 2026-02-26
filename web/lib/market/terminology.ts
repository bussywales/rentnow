export type MarketSearchTerminology = {
  locationFieldLabel: string;
  locationPlaceholder: string;
  locationHint: string;
  homeTypeNoun: string;
};

function normalizeMarketCountry(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "GB") return "UK";
  return normalized || "GLOBAL";
}

const DEFAULT_TERMINOLOGY: MarketSearchTerminology = {
  locationFieldLabel: "Location",
  locationPlaceholder: "City or area",
  locationHint: "Try a city, area, or landmark.",
  homeTypeNoun: "homes",
};

export function getMarketSearchTerminology(marketCountry: string | null | undefined): MarketSearchTerminology {
  const market = normalizeMarketCountry(marketCountry);
  if (market === "UK") {
    return {
      locationFieldLabel: "Location or postcode",
      locationPlaceholder: "City, postcode, or area",
      locationHint: "Try a city, postcode, or area.",
      homeTypeNoun: "flats",
    };
  }
  if (market === "US") {
    return {
      locationFieldLabel: "Location or ZIP code",
      locationPlaceholder: "City, ZIP code, or neighborhood",
      locationHint: "Try a city, ZIP code, or neighborhood.",
      homeTypeNoun: "apartments",
    };
  }
  if (market === "CA") {
    return {
      locationFieldLabel: "Location or postal code",
      locationPlaceholder: "City, postal code, or area",
      locationHint: "Try a city, postal code, or area.",
      homeTypeNoun: "apartments",
    };
  }
  if (market === "NG") {
    return {
      locationFieldLabel: "Location or area",
      locationPlaceholder: "City, area, or landmark",
      locationHint: "Try a city, area, apartment, or flat location.",
      homeTypeNoun: "apartments or flats",
    };
  }
  return DEFAULT_TERMINOLOGY;
}
