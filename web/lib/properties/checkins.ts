const EARTH_RADIUS_M = 6371000;
export const ONSITE_THRESHOLD_M = 150;
export const NEAR_THRESHOLD_M = 1000;
export const RECENT_CHECKIN_DAYS = 7;

export type DistanceBucket = "onsite" | "near" | "far";
export type CheckinSignalStatus = "recent_checkin" | "stale_checkin" | "none" | "hidden";

export type CheckinRow = {
  property_id: string;
  created_at: string;
  distance_bucket: DistanceBucket | null;
  method?: string | null;
};

export function haversineDistanceMeters({
  lat1,
  lng1,
  lat2,
  lng2,
}: {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function bucketDistance(distanceMeters: number): DistanceBucket {
  if (!Number.isFinite(distanceMeters)) return "far";
  if (distanceMeters <= ONSITE_THRESHOLD_M) return "onsite";
  if (distanceMeters <= NEAR_THRESHOLD_M) return "near";
  return "far";
}

export function deriveCheckinSignal(
  latest: CheckinRow | null,
  { flagEnabled }: { flagEnabled: boolean }
): { status: CheckinSignalStatus; bucket: DistanceBucket | null; checkedInAt: string | null } {
  if (!flagEnabled) return { status: "hidden", bucket: null, checkedInAt: null };
  if (!latest || !latest.distance_bucket || !latest.created_at) {
    return { status: "none", bucket: null, checkedInAt: null };
  }
  const createdAt = new Date(latest.created_at);
  if (Number.isNaN(createdAt.getTime())) return { status: "none", bucket: null, checkedInAt: null };
  const now = Date.now();
  const ageMs = now - createdAt.getTime();
  const recentWindowMs = RECENT_CHECKIN_DAYS * 24 * 60 * 60 * 1000;
  const status: CheckinSignalStatus = ageMs <= recentWindowMs ? "recent_checkin" : "stale_checkin";
  return { status, bucket: latest.distance_bucket, checkedInAt: createdAt.toISOString() };
}

export function sanitizeAccuracyM(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const clamped = Math.min(Math.max(Math.round(value), 0), 100000);
  return clamped;
}
