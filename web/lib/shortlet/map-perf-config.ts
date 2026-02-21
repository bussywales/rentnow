export type ShortletsMapPerfConfig = {
  clusterThreshold: number;
  clusterEnabled: boolean;
  markerIconCacheEnabled: boolean;
};

const DEFAULT_CLUSTER_THRESHOLD = 80;
const DEFAULT_CLUSTER_ENABLED = true;
const DEFAULT_ICON_CACHE_ENABLED = true;
const MIN_CLUSTER_THRESHOLD = 1;
const MAX_CLUSTER_THRESHOLD = 500;

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseClusterThreshold(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_CLUSTER_THRESHOLD, Math.max(MIN_CLUSTER_THRESHOLD, parsed));
}

export function resolveShortletsMapPerfConfig(
  env: Record<string, string | undefined> = process.env
): ShortletsMapPerfConfig {
  return {
    clusterThreshold: parseClusterThreshold(
      env.NEXT_PUBLIC_SHORTLETS_CLUSTER_THRESHOLD,
      DEFAULT_CLUSTER_THRESHOLD
    ),
    clusterEnabled: parseBooleanEnv(
      env.NEXT_PUBLIC_SHORTLETS_CLUSTER_ENABLED,
      DEFAULT_CLUSTER_ENABLED
    ),
    markerIconCacheEnabled: parseBooleanEnv(
      env.NEXT_PUBLIC_SHORTLETS_ICON_CACHE_ENABLED,
      DEFAULT_ICON_CACHE_ENABLED
    ),
  };
}

const resolved = resolveShortletsMapPerfConfig();

export const SHORTLETS_CLUSTER_THRESHOLD = resolved.clusterThreshold;
export const SHORTLETS_CLUSTER_ENABLED = resolved.clusterEnabled;
export const SHORTLETS_MARKER_ICON_CACHE_ENABLED = resolved.markerIconCacheEnabled;
