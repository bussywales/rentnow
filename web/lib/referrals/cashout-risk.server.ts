import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CashoutRiskLevel = "none" | "low" | "medium" | "high";

export type CashoutRiskFlag =
  | "ip_cluster"
  | "ua_cluster"
  | "rapid_captures"
  | "deep_chain"
  | "geo_mismatch";

export type CashoutRiskStats = {
  captures_1h: number;
  captures_24h: number;
  distinct_ip_hash_24h: number;
  distinct_ua_hash_24h: number;
  geo_mismatch_count_24h: number;
  deep_referrals_30d: number;
  max_depth_30d: number;
};

export type CashoutRiskResult = {
  risk_level: CashoutRiskLevel;
  risk_flags: CashoutRiskFlag[];
  supporting_stats: CashoutRiskStats;
};

export type CashoutRiskRuleInput = {
  ipCluster: boolean;
  uaCluster: boolean;
  rapidCaptures: boolean;
  deepChain: boolean;
  geoMismatch: boolean;
};

export function computeUserAgentHash(userAgent: string | null | undefined): string | null {
  const value = String(userAgent || "").trim();
  if (!value) return null;
  return createHash("sha256").update(value.toLowerCase()).digest("hex");
}

export function resolveCashoutRiskLevel(input: CashoutRiskRuleInput): CashoutRiskLevel {
  if ((input.ipCluster && input.rapidCaptures) || input.deepChain) return "high";
  if (input.ipCluster || input.uaCluster || input.geoMismatch) return "medium";
  if (input.rapidCaptures) return "low";
  return "none";
}

export function deriveCashoutRiskFlags(input: CashoutRiskRuleInput): CashoutRiskFlag[] {
  const flags: CashoutRiskFlag[] = [];
  if (input.ipCluster) flags.push("ip_cluster");
  if (input.uaCluster) flags.push("ua_cluster");
  if (input.rapidCaptures) flags.push("rapid_captures");
  if (input.deepChain) flags.push("deep_chain");
  if (input.geoMismatch) flags.push("geo_mismatch");
  return flags;
}

export async function evaluateCashoutRisk(input: {
  client: SupabaseClient;
  referrerOwnerId: string;
  countryCode: string;
  requestedAt?: string | null;
}): Promise<CashoutRiskResult> {
  const now =
    input.requestedAt && Number.isFinite(Date.parse(input.requestedAt))
      ? new Date(input.requestedAt)
      : new Date();
  const since1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [campaignsResult, deepResult] = await Promise.all([
    input.client
      .from("referral_share_campaigns")
      .select("id")
      .eq("owner_id", input.referrerOwnerId)
      .limit(1000),
    input.client
      .from("referrals")
      .select("depth")
      .eq("referrer_user_id", input.referrerOwnerId)
      .gte("created_at", since30d)
      .gte("depth", 3)
      .limit(5000),
  ]);

  const campaignIds = (((campaignsResult.data as Array<{ id: string }> | null) ?? [])
    .map((row) => String(row.id || ""))
    .filter(Boolean));

  let touchRows: Array<{
    created_at: string;
    ip_hash: string | null;
    user_agent: string | null;
    country_code: string | null;
  }> = [];

  if (campaignIds.length) {
    const { data } = await input.client
      .from("referral_touch_events")
      .select("created_at, ip_hash, user_agent, country_code")
      .in("campaign_id", campaignIds)
      .eq("event_type", "captured")
      .gte("created_at", since24h)
      .limit(20000);
    touchRows = (data as typeof touchRows | null) ?? [];
  }

  const captures24h = touchRows.length;
  const captures1h = touchRows.filter(
    (row) => Number.isFinite(Date.parse(row.created_at)) && row.created_at >= since1h
  ).length;

  const ipCounts = new Map<string, number>();
  const uaCounts = new Map<string, number>();
  let geoMismatchCount24h = 0;
  const requestCountry = String(input.countryCode || "").trim().toUpperCase();

  for (const row of touchRows) {
    const ipHash = String(row.ip_hash || "").trim();
    if (ipHash) {
      ipCounts.set(ipHash, (ipCounts.get(ipHash) ?? 0) + 1);
    }

    const uaHash = computeUserAgentHash(row.user_agent);
    if (uaHash) {
      uaCounts.set(uaHash, (uaCounts.get(uaHash) ?? 0) + 1);
    }

    const rowCountry = String(row.country_code || "").trim().toUpperCase();
    if (requestCountry && rowCountry && rowCountry !== requestCountry) {
      geoMismatchCount24h += 1;
    }
  }

  const deepRows = (deepResult.data as Array<{ depth: number | null }> | null) ?? [];
  const deepReferrals30d = deepRows.length;
  const maxDepth30d = deepRows.reduce(
    (max, row) => Math.max(max, Math.max(0, Math.trunc(Number(row.depth || 0)))),
    0
  );

  const maxIpCluster = Array.from(ipCounts.values()).reduce((max, value) => Math.max(max, value), 0);
  const maxUaCluster = Array.from(uaCounts.values()).reduce((max, value) => Math.max(max, value), 0);
  const ipCluster = maxIpCluster >= 5;
  const uaCluster = maxUaCluster >= 5;
  const rapidCaptures = captures1h >= 3;
  const deepChain = deepReferrals30d >= 5 || maxDepth30d >= 4;
  const geoMismatch =
    captures24h >= 3 && geoMismatchCount24h >= 3 && geoMismatchCount24h / captures24h >= 0.6;

  const riskFlags = deriveCashoutRiskFlags({
    ipCluster,
    uaCluster,
    rapidCaptures,
    deepChain,
    geoMismatch,
  });

  return {
    risk_level: resolveCashoutRiskLevel({
      ipCluster,
      uaCluster,
      rapidCaptures,
      deepChain,
      geoMismatch,
    }),
    risk_flags: riskFlags,
    supporting_stats: {
      captures_1h: captures1h,
      captures_24h: captures24h,
      distinct_ip_hash_24h: ipCounts.size,
      distinct_ua_hash_24h: uaCounts.size,
      geo_mismatch_count_24h: geoMismatchCount24h,
      deep_referrals_30d: deepReferrals30d,
      max_depth_30d: maxDepth30d,
    },
  };
}
