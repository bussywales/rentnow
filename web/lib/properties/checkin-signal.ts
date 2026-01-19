import { hasServiceRoleEnv, createServiceRoleClient } from "@/lib/supabase/admin";
import { deriveCheckinSignal, type CheckinRow } from "./checkins";
import type { DistanceBucket } from "./checkins";

export type LatestCheckin = {
  property_id: string;
  created_at: string | null;
  distance_bucket: DistanceBucket | null;
};

export async function fetchLatestCheckins(
  propertyIds: string[]
): Promise<Map<string, LatestCheckin>> {
  const map = new Map<string, LatestCheckin>();
  if (!propertyIds.length || !hasServiceRoleEnv()) return map;
  const adminDb = createServiceRoleClient();
  const { data, error } = await adminDb
    .from("property_checkins")
    .select("property_id, created_at, distance_bucket")
    .in("property_id", propertyIds)
    .order("created_at", { ascending: false });
  if (error || !data) return map;
  for (const row of data as unknown as CheckinRow[]) {
    if (!map.has(row.property_id)) {
      map.set(row.property_id, {
        property_id: row.property_id,
        created_at: row.created_at ?? null,
        distance_bucket: row.distance_bucket ?? null,
      });
    }
  }
  return map;
}

export function buildCheckinSignal(
  latest: LatestCheckin | null,
  { flagEnabled }: { flagEnabled: boolean }
) {
  if (!latest) return deriveCheckinSignal(null, { flagEnabled });
  return deriveCheckinSignal(
    {
      property_id: latest.property_id,
      created_at: latest.created_at ?? "",
      distance_bucket: latest.distance_bucket,
      method: null,
    },
    { flagEnabled }
  );
}
