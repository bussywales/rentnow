export type ShortletAvailabilityPrefetchConfig = {
  enabled: boolean;
  immediateMonthOffsets: number[];
  deferredMonthOffsets: number[];
  debounceMs: number;
  maxInflight: number;
};

const DEFAULT_PREFETCH_ENABLED = true;
const DEFAULT_IMMEDIATE_OFFSETS = [0, 1] as const;
const DEFAULT_DEFERRED_OFFSETS = [-2, -1, 2] as const;
const DEFAULT_PREFETCH_DEBOUNCE_MS = 180;
const DEFAULT_PREFETCH_MAX_INFLIGHT = 2;

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntEnv(
  value: string | undefined,
  fallback: number,
  input: { min?: number; max?: number } = {}
): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  const min = Math.max(0, Math.trunc(input.min ?? 0));
  const max = Math.max(min, Math.trunc(input.max ?? Number.MAX_SAFE_INTEGER));
  return Math.min(max, Math.max(min, parsed));
}

export function resolveShortletAvailabilityPrefetchConfig(
  env: Record<string, string | undefined> = process.env
): ShortletAvailabilityPrefetchConfig {
  return {
    enabled: parseBooleanEnv(
      env.NEXT_PUBLIC_SHORTLET_PREFETCH_ENABLED,
      DEFAULT_PREFETCH_ENABLED
    ),
    immediateMonthOffsets: [...DEFAULT_IMMEDIATE_OFFSETS],
    deferredMonthOffsets: [...DEFAULT_DEFERRED_OFFSETS],
    debounceMs: parsePositiveIntEnv(
      env.NEXT_PUBLIC_SHORTLET_PREFETCH_DEBOUNCE_MS,
      DEFAULT_PREFETCH_DEBOUNCE_MS,
      { min: 50, max: 1_000 }
    ),
    maxInflight: parsePositiveIntEnv(
      env.NEXT_PUBLIC_SHORTLET_PREFETCH_MAX_INFLIGHT,
      DEFAULT_PREFETCH_MAX_INFLIGHT,
      { min: 1, max: 8 }
    ),
  };
}

const resolved = resolveShortletAvailabilityPrefetchConfig();

export const PREFETCH_ENABLED = resolved.enabled;
export const PREFETCH_IMMEDIATE_MONTH_OFFSETS = resolved.immediateMonthOffsets;
export const PREFETCH_DEFERRED_MONTH_OFFSETS = resolved.deferredMonthOffsets;
export const PREFETCH_DEBOUNCE_MS = resolved.debounceMs;
export const PREFETCH_MAX_INFLIGHT = resolved.maxInflight;
