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
};

const SLOW_EFFECTIVE_TYPES = new Set<string>(["slow-2g", "2g", "3g"]);

export function isConstrainedEffectiveType(effectiveType: string | null | undefined): boolean {
  if (typeof effectiveType !== "string") return false;
  return SLOW_EFFECTIVE_TYPES.has(effectiveType.trim().toLowerCase());
}

export function shouldConserveData(connection: ExploreNetworkConnection | null | undefined): boolean {
  if (!connection) return false;
  if (connection.saveData) return true;
  return isConstrainedEffectiveType(connection.effectiveType);
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
