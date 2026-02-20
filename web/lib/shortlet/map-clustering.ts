export const SHORTLET_MAP_CLUSTER_THRESHOLD = 80;

export function shouldEnableShortletMapClustering(
  markerCount: number,
  threshold = SHORTLET_MAP_CLUSTER_THRESHOLD
): boolean {
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
