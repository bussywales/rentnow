export type HostListingAnalyticsMode = "compact" | "expanded";

const MODE_KEY_PREFIX = "home:host:listing-analytics:mode:v1";
const COLLAPSED_KEY_PREFIX = "home:host:listing-analytics:collapsed:v1";

export function buildHostListingAnalyticsPreferenceKeys(userId?: string | null) {
  const suffix = userId ?? "anon";
  return {
    modeKey: `${MODE_KEY_PREFIX}:${suffix}`,
    collapsedKey: `${COLLAPSED_KEY_PREFIX}:${suffix}`,
  };
}

export function parseHostListingAnalyticsMode(value: string | null | undefined): HostListingAnalyticsMode {
  return value === "expanded" ? "expanded" : "compact";
}

export function parseHostListingAnalyticsCollapsed(value: string | null | undefined) {
  return value === "1";
}

export function getHostListingAnalyticsPanelModel(mode: HostListingAnalyticsMode) {
  if (mode === "compact") {
    return {
      rowCount: 1,
      containerClassName: "px-3 py-1.5",
    };
  }

  return {
    rowCount: 3,
    containerClassName: "px-3 py-2.5",
  };
}
