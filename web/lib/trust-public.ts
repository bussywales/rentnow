import type { TrustMarkerState } from "@/lib/trust-markers";

export type TrustPublicRow = {
  profile_id: string;
  email_verified: boolean | null;
  phone_verified: boolean | null;
  bank_verified: boolean | null;
  host_rating: number | null;
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

  const response = await supabase.rpc("get_profiles_trust_public", {
    profile_ids: uniqueIds,
  });
  const data = response?.data ?? null;
  const error = response?.error ?? null;

  if (error || !Array.isArray(data)) {
    console.warn("[trust-public] failed to load trust snapshots", {
      error: error?.message,
      requested: uniqueIds.length,
    });
    return {};
  }

  return data.reduce<Record<string, TrustMarkerState>>((acc, row) => {
    acc[row.profile_id] = mapTrustPublicToMarkers(row);
    return acc;
  }, {});
}
