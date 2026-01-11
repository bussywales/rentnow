import type { TrustMarkerState } from "@/lib/trust-markers";

export type TrustPublicRow = {
  profile_id: string;
  email_verified: boolean | null;
  phone_verified: boolean | null;
  bank_verified: boolean | null;
  power_reliability: string | null;
  water_reliability: string | null;
  internet_reliability: string | null;
};

type TrustPublicRpcClient = {
  rpc: (
    fn: string,
    params?: Record<string, unknown>
  ) => PromiseLike<{
    data: TrustPublicRow[] | null;
    error: { message?: string } | null;
  }>;
};

export function mapTrustPublicToMarkers(row: TrustPublicRow): TrustMarkerState {
  return {
    email_verified: row.email_verified,
    phone_verified: row.phone_verified,
    bank_verified: row.bank_verified,
    reliability_power: row.power_reliability,
    reliability_water: row.water_reliability,
    reliability_internet: row.internet_reliability,
  };
}

export async function fetchTrustPublicSnapshots(
  supabase: TrustPublicRpcClient,
  profileIds: string[]
): Promise<Record<string, TrustMarkerState>> {
  const uniqueIds = Array.from(new Set(profileIds.filter(Boolean)));
  if (!uniqueIds.length) return {};

  const responses = await Promise.all(
    uniqueIds.map(async (profileId) => {
      const response = await supabase.rpc("get_trust_snapshot", {
        target_profile_id: profileId,
      });
      return { profileId, response };
    })
  );

  return responses.reduce<Record<string, TrustMarkerState>>((acc, entry) => {
    const data = entry.response?.data ?? null;
    const error = entry.response?.error ?? null;
    if (error || !Array.isArray(data) || !data[0]) {
      if (error) {
        console.warn("[trust-public] failed to load trust snapshot", {
          error: error?.message,
          profileId: entry.profileId,
        });
      }
      return acc;
    }
    acc[entry.profileId] = mapTrustPublicToMarkers(data[0]);
    return acc;
  }, {});
}
