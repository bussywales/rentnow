import type { ProviderMode } from "@/lib/billing/provider-settings";

export function resolveReplayMode(storedMode: string | null | undefined, providerMode: ProviderMode): ProviderMode {
  if (storedMode === "live" || storedMode === "test") {
    return storedMode;
  }
  return providerMode;
}

export function isReplayAlreadyProcessed(eventRow: { status?: string | null; processed_at?: string | null }) {
  return eventRow.status === "processed" && !!eventRow.processed_at;
}
