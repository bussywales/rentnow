export const IMAGE_OPTIMIZATION_MODES = [
  "vercel_default",
  "disable_non_critical",
  "disable_all",
] as const;

export type ImageOptimizationMode = (typeof IMAGE_OPTIMIZATION_MODES)[number];
export type ImageOptimizationUsage = "critical" | "default" | "noncritical";

export function normalizeImageOptimizationMode(
  value: unknown,
  fallback: ImageOptimizationMode = "vercel_default"
): ImageOptimizationMode {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (IMAGE_OPTIMIZATION_MODES.includes(trimmed as ImageOptimizationMode)) {
      return trimmed as ImageOptimizationMode;
    }
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    const nested = (value as { value?: unknown }).value;
    if (typeof nested === "string") {
      const trimmed = nested.trim();
      if (IMAGE_OPTIMIZATION_MODES.includes(trimmed as ImageOptimizationMode)) {
        return trimmed as ImageOptimizationMode;
      }
    }
  }
  return fallback;
}

export function shouldDisableImageOptimizationForUsage(input: {
  mode: ImageOptimizationMode;
  usage?: ImageOptimizationUsage;
  bypassOptimizer?: boolean;
}) {
  const usage = input.usage ?? "default";
  if (input.bypassOptimizer) return true;
  if (input.mode === "disable_all") return true;
  if (input.mode === "disable_non_critical") {
    return usage === "noncritical";
  }
  return false;
}
