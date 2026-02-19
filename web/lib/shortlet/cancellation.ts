export type ShortletCancellationPolicy =
  | "flexible_24h"
  | "flexible_48h"
  | "moderate_5d"
  | "strict";

type ShortletCancellationSettingsLike = {
  cancellation_policy?: string | null;
};

type ShortletCancellationSignals = {
  shortlet_settings?:
    | ShortletCancellationSettingsLike
    | ShortletCancellationSettingsLike[]
    | null;
};

export const DEFAULT_SHORTLET_CANCELLATION_POLICY: ShortletCancellationPolicy = "flexible_48h";

export function normalizeShortletCancellationPolicy(
  value: string | null | undefined
): ShortletCancellationPolicy | null {
  if (value === "flexible_24h") return "flexible_24h";
  if (value === "flexible_48h") return "flexible_48h";
  if (value === "moderate_5d") return "moderate_5d";
  if (value === "strict") return "strict";
  return null;
}

function parseSettings(
  value: ShortletCancellationSignals["shortlet_settings"]
): ShortletCancellationSettingsLike | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? first : null;
  }
  return value && typeof value === "object" ? value : null;
}

export function resolveShortletCancellationPolicy(
  input: ShortletCancellationSignals
): ShortletCancellationPolicy {
  const settings = parseSettings(input.shortlet_settings);
  return (
    normalizeShortletCancellationPolicy(settings?.cancellation_policy) ??
    DEFAULT_SHORTLET_CANCELLATION_POLICY
  );
}

export function isFreeCancellationPolicy(
  policy: ShortletCancellationPolicy | null | undefined
): boolean {
  return policy === "flexible_24h" || policy === "flexible_48h" || policy === "moderate_5d";
}

export function formatShortletCancellationLabel(
  policy: ShortletCancellationPolicy | null | undefined
): string {
  switch (policy) {
    case "flexible_24h":
      return "Free cancellation until 24 hours before check-in";
    case "moderate_5d":
      return "Free cancellation until 5 days before check-in";
    case "strict":
      return "Cancellation policy: Strict";
    case "flexible_48h":
    default:
      return "Free cancellation until 48 hours before check-in";
  }
}
