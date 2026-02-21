import {
  SHORTLETS_CLUSTER_ENABLED,
  SHORTLETS_CLUSTER_THRESHOLD,
} from "@/lib/shortlet/map-perf-config";

export function shouldEnableShortletMapClustering(
  markerCount: number,
  options?: { threshold?: number; enabled?: boolean }
): boolean {
  const enabled = options?.enabled ?? SHORTLETS_CLUSTER_ENABLED;
  if (!enabled) return false;
  const threshold = options?.threshold ?? SHORTLETS_CLUSTER_THRESHOLD;
  if (!Number.isFinite(markerCount) || markerCount <= 0) return false;
  return markerCount >= threshold;
}

export function retainSelectedShortletMarkerId(input: {
  selectedListingId: string | null;
  markerIds: string[];
}): string | null {
  if (!input.selectedListingId) return null;
  return input.markerIds.includes(input.selectedListingId) ? input.selectedListingId : null;
}
