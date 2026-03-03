type EffectiveConnectionType = "slow-2g" | "2g" | "3g" | "4g";

type ExploreNetworkEventTarget = {
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

export type ExploreNetworkConnection = ExploreNetworkEventTarget & {
  saveData?: boolean;
  effectiveType?: EffectiveConnectionType | string;
};

export type ExploreNavigatorWithConnection = Navigator & {
  connection?: ExploreNetworkConnection;
  deviceMemory?: number;
};

const SLOW_EFFECTIVE_TYPES = new Set<string>(["slow-2g", "2g", "3g"]);
const PREFETCH_BLOCKED_EFFECTIVE_TYPES = new Set<string>(["slow-2g", "2g"]);
const EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD = 2;

export function isConstrainedEffectiveType(effectiveType: string | null | undefined): boolean {
  if (typeof effectiveType !== "string") return false;
  return SLOW_EFFECTIVE_TYPES.has(effectiveType.trim().toLowerCase());
}

export function isExploreV2PrefetchBlockedEffectiveType(
  effectiveType: string | null | undefined
): boolean {
  if (typeof effectiveType !== "string") return false;
  return PREFETCH_BLOCKED_EFFECTIVE_TYPES.has(effectiveType.trim().toLowerCase());
}

export function shouldConserveData(connection: ExploreNetworkConnection | null | undefined): boolean {
  if (!connection) return false;
  if (connection.saveData) return true;
  return isConstrainedEffectiveType(connection.effectiveType);
}

function normalizePrefetchLookahead(lookahead: number | undefined): number {
  if (!Number.isFinite(lookahead)) return EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD;
  return Math.max(0, Math.min(EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD, Math.trunc(lookahead as number)));
}

export function shouldDisableExploreV2Prefetch(
  connection: ExploreNetworkConnection | null | undefined
): boolean {
  if (!connection) return false;
  if (connection.saveData) return true;
  return isExploreV2PrefetchBlockedEffectiveType(connection.effectiveType);
}

export function resolveExploreV2PrefetchLookahead(
  navigatorLike: ExploreNavigatorWithConnection | null | undefined = typeof navigator === "undefined"
    ? null
    : (navigator as ExploreNavigatorWithConnection),
  maxLookahead?: number
): number {
  const normalizedLookahead = normalizePrefetchLookahead(maxLookahead);
  if (normalizedLookahead === 0) return 0;
  if (shouldDisableExploreV2Prefetch(navigatorLike?.connection)) return 0;

  const deviceMemory = navigatorLike?.deviceMemory;
  if (typeof deviceMemory === "number" && Number.isFinite(deviceMemory)) {
    if (deviceMemory <= 1) return 0;
    if (deviceMemory <= 2) return Math.min(1, normalizedLookahead);
  }

  return normalizedLookahead;
}

export function readShouldConserveData(
  navigatorLike: ExploreNavigatorWithConnection | null | undefined = typeof navigator === "undefined"
    ? null
    : (navigator as ExploreNavigatorWithConnection)
): boolean {
  return shouldConserveData(navigatorLike?.connection);
}

export function subscribeToConserveDataChanges(
  onChange: (next: boolean) => void,
  navigatorLike: ExploreNavigatorWithConnection | null | undefined = typeof navigator === "undefined"
    ? null
    : (navigator as ExploreNavigatorWithConnection)
): () => void {
  const connection = navigatorLike?.connection;
  if (!connection?.addEventListener || !connection.removeEventListener) return () => {};
  const notify = () => {
    onChange(shouldConserveData(connection));
  };
  connection.addEventListener("change", notify);
  return () => {
    connection.removeEventListener?.("change", notify);
  };
}
