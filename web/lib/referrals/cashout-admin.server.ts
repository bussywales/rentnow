import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReferralCashoutStatus } from "@/lib/referrals/cashout";
import { evaluateCashoutRisk, type CashoutRiskResult } from "@/lib/referrals/cashout-risk.server";

export type AdminCashoutQueueStatus = ReferralCashoutStatus | "held";
export type AdminCashoutRiskFilter = "any" | "flagged";
export type AdminCashoutTimeframe = "today" | "7d" | "30d" | "all";

export type AdminCashoutQueueFilters = {
  status?: "all" | AdminCashoutQueueStatus;
  risk?: AdminCashoutRiskFilter;
  countryCode?: string | null;
  timeframe?: AdminCashoutTimeframe;
  limit?: number;
};

export type AdminCashoutQueueRow = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  rate_used: number;
  status: ReferralCashoutStatus;
  queue_status: AdminCashoutQueueStatus;
  admin_note: string | null;
  payout_reference: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  risk_level: CashoutRiskResult["risk_level"];
  risk_flags: CashoutRiskResult["risk_flags"];
  risk_stats: CashoutRiskResult["supporting_stats"];
  requires_manual_approval: boolean;
  last_action: {
    action_type: string;
    actor_id: string | null;
    actor_name: string | null;
    created_at: string;
  } | null;
};

type RawCashoutRow = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  rate_used: number;
  status: ReferralCashoutStatus;
  admin_note: string | null;
  payout_reference: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
};

const EMPTY_RISK_STATS: CashoutRiskResult["supporting_stats"] = {
  captures_1h: 0,
  captures_24h: 0,
  distinct_ip_hash_24h: 0,
  distinct_ua_hash_24h: 0,
  geo_mismatch_count_24h: 0,
  deep_referrals_30d: 0,
  max_depth_30d: 0,
};

function normalizeStatus(value: string | null | undefined): "all" | AdminCashoutQueueStatus {
  const v = String(value || "").trim().toLowerCase();
  if (
    v === "pending" ||
    v === "held" ||
    v === "approved" ||
    v === "rejected" ||
    v === "paid" ||
    v === "void"
  ) {
    return v;
  }
  return "all";
}

function normalizeRisk(value: string | null | undefined): AdminCashoutRiskFilter {
  const v = String(value || "").trim().toLowerCase();
  return v === "flagged" ? "flagged" : "any";
}

function normalizeTimeframe(value: string | null | undefined): AdminCashoutTimeframe {
  const v = String(value || "").trim().toLowerCase();
  if (v === "today" || v === "7d" || v === "30d" || v === "all") return v;
  return "30d";
}

export function parseAdminCashoutQueueFilters(searchParams: URLSearchParams): AdminCashoutQueueFilters {
  const status = normalizeStatus(searchParams.get("status"));
  const risk = normalizeRisk(searchParams.get("risk"));
  const timeframe = normalizeTimeframe(searchParams.get("timeframe"));
  const countryCode = String(searchParams.get("country_code") || "")
    .trim()
    .toUpperCase();
  const limitRaw = Number(searchParams.get("limit") || 200);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.trunc(limitRaw))) : 200;

  return {
    status,
    risk,
    timeframe,
    countryCode: countryCode || null,
    limit,
  };
}

function timeframeSinceIso(timeframe: AdminCashoutTimeframe): string | null {
  const now = new Date();
  if (timeframe === "all") return null;
  if (timeframe === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  const days = timeframe === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function deriveQueueStatus(input: {
  status: ReferralCashoutStatus;
  requiresManualApproval: boolean;
  risk: CashoutRiskResult;
}): AdminCashoutQueueStatus {
  if (
    input.status === "pending" &&
    (input.requiresManualApproval ||
      input.risk.risk_level === "medium" ||
      input.risk.risk_level === "high")
  ) {
    return "held";
  }
  return input.status;
}

export function validateCashoutActionTransition(input: {
  action: "approve" | "reject" | "paid" | "void";
  currentStatus: ReferralCashoutStatus;
  queueStatus: AdminCashoutQueueStatus;
  reason: string | null;
  isBulk?: boolean;
}):
  | { ok: true }
  | {
      ok: false;
      status: 409 | 422;
      reason: string;
    } {
  const reasonText = String(input.reason || "").trim();
  const queueStatus = input.queueStatus;
  const current = input.currentStatus;

  if (input.action === "approve") {
    if (current !== "pending") {
      return { ok: false, status: 409, reason: "Only pending requests can be approved." };
    }
    if (input.isBulk && queueStatus === "held") {
      return { ok: false, status: 409, reason: "HELD requests cannot be bulk-approved." };
    }
    if (queueStatus === "held" && !reasonText) {
      return { ok: false, status: 422, reason: "Reason is required to approve a HELD request." };
    }
    return { ok: true };
  }

  if (input.action === "reject") {
    if (current !== "pending") {
      return { ok: false, status: 409, reason: "Only pending or held requests can be rejected." };
    }
    if (!reasonText) {
      return { ok: false, status: 422, reason: "Reason is required for rejection." };
    }
    return { ok: true };
  }

  if (input.action === "paid") {
    if (current !== "approved") {
      return { ok: false, status: 409, reason: "Only approved requests can be marked paid." };
    }
    return { ok: true };
  }

  if (input.action === "void") {
    if (!(current === "pending" || current === "approved")) {
      return { ok: false, status: 409, reason: "Only pending, held, or approved requests can be voided." };
    }
    return { ok: true };
  }

  return { ok: false, status: 409, reason: "Invalid transition." };
}

export async function fetchAdminCashoutQueue(input: {
  client: SupabaseClient;
  filters: AdminCashoutQueueFilters;
}): Promise<AdminCashoutQueueRow[]> {
  const status = normalizeStatus(input.filters.status);
  const riskFilter = input.filters.risk ?? "any";
  const timeframe = input.filters.timeframe ?? "30d";
  const limit = Number.isFinite(input.filters.limit || 0)
    ? Math.max(1, Math.min(1000, Math.trunc(input.filters.limit || 200)))
    : 200;

  let query = input.client
    .from("referral_cashout_requests")
    .select(
      "id, user_id, country_code, credits_requested, cash_amount, currency, rate_used, status, admin_note, payout_reference, requested_at, decided_at, paid_at"
    )
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (status !== "all" && status !== "held") {
    query = query.eq("status", status);
  }
  if (status === "held") {
    query = query.eq("status", "pending");
  }
  if (input.filters.countryCode) {
    query = query.eq("country_code", input.filters.countryCode);
  }
  const sinceIso = timeframeSinceIso(timeframe);
  if (sinceIso) {
    query = query.gte("requested_at", sinceIso);
  }

  const { data } = await query;
  const rows = (data as RawCashoutRow[] | null) ?? [];
  if (!rows.length) return [];

  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
  const countryCodes = Array.from(
    new Set(rows.map((row) => String(row.country_code || "").trim().toUpperCase()).filter(Boolean))
  );
  const requestIds = rows.map((row) => row.id);

  const [profilesResult, policyResult, auditResult] = await Promise.all([
    userIds.length
      ? input.client.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    countryCodes.length
      ? input.client
          .from("referral_jurisdiction_policies")
          .select("country_code, requires_manual_approval")
          .in("country_code", countryCodes)
      : Promise.resolve({ data: [] }),
    requestIds.length
      ? input.client
          .from("referral_cashout_audit")
          .select("request_id, action_type, actor_id, created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map<string, { full_name: string | null }>();
  for (const row of ((profilesResult.data as Array<{ id: string; full_name: string | null }> | null) ?? [])) {
    profileMap.set(row.id, { full_name: row.full_name ?? null });
  }

  const manualMap = new Map<string, boolean>();
  for (const row of ((policyResult.data as Array<{ country_code: string; requires_manual_approval: boolean | null }> | null) ?? [])) {
    manualMap.set(
      String(row.country_code || "").trim().toUpperCase(),
      Boolean(row.requires_manual_approval)
    );
  }

  const lastAuditByRequest = new Map<
    string,
    { action_type: string; actor_id: string | null; created_at: string }
  >();
  const actorIds = new Set<string>();
  for (const row of ((auditResult.data as Array<{
    request_id: string;
    action_type: string;
    actor_id: string | null;
    created_at: string;
  }> | null) ?? [])) {
    if (!lastAuditByRequest.has(row.request_id)) {
      lastAuditByRequest.set(row.request_id, {
        action_type: row.action_type,
        actor_id: row.actor_id ?? null,
        created_at: row.created_at,
      });
      if (row.actor_id) actorIds.add(row.actor_id);
    }
  }

  const actorMap = new Map<string, string | null>();
  if (actorIds.size) {
    const { data: actorRows } = await input.client
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(actorIds));
    for (const row of ((actorRows as Array<{ id: string; full_name: string | null }> | null) ?? [])) {
      actorMap.set(row.id, row.full_name ?? null);
    }
  }

  const riskMap = new Map<string, CashoutRiskResult>();
  const pendingUserIds = Array.from(
    new Set(rows.filter((row) => row.status === "pending").map((row) => row.user_id).filter(Boolean))
  );
  await Promise.all(
    pendingUserIds.map(async (userId) => {
      const latestRow = rows.find((row) => row.user_id === userId && row.status === "pending");
      if (!latestRow) return;
      const risk = await evaluateCashoutRisk({
        client: input.client,
        referrerOwnerId: userId,
        countryCode: latestRow.country_code,
        requestedAt: latestRow.requested_at,
      });
      riskMap.set(userId, risk);
    })
  );

  const enriched = rows.map<AdminCashoutQueueRow>((row) => {
    const countryCode = String(row.country_code || "").trim().toUpperCase();
    const requiresManualApproval = manualMap.get(countryCode) ?? true;
    const risk = riskMap.get(row.user_id) ?? {
      risk_level: "none",
      risk_flags: [],
      supporting_stats: EMPTY_RISK_STATS,
    };
    const queueStatus = deriveQueueStatus({
      status: row.status,
      requiresManualApproval,
      risk,
    });
    const profile = profileMap.get(row.user_id);
    const lastAudit = lastAuditByRequest.get(row.id) ?? null;
    return {
      ...row,
      country_code: countryCode,
      queue_status: queueStatus,
      user: {
        id: row.user_id,
        full_name: profile?.full_name ?? null,
        email: null,
      },
      risk_level: risk.risk_level,
      risk_flags: risk.risk_flags,
      risk_stats: risk.supporting_stats,
      requires_manual_approval: requiresManualApproval,
      last_action: lastAudit
        ? {
            action_type: lastAudit.action_type,
            actor_id: lastAudit.actor_id,
            actor_name: lastAudit.actor_id ? actorMap.get(lastAudit.actor_id) ?? null : null,
            created_at: lastAudit.created_at,
          }
        : null,
    };
  });

  const filteredByDerived = enriched.filter((row) => {
    if (status !== "all" && row.queue_status !== status) return false;
    if (riskFilter === "flagged" && row.risk_level === "none") return false;
    return true;
  });

  return filteredByDerived;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, "\"\"")}"`;
  return value;
}

export function buildAdminCashoutCsv(rows: AdminCashoutQueueRow[]): string {
  const header = [
    "request_id",
    "user_id",
    "country_code",
    "credits_requested",
    "cash_amount",
    "currency",
    "status",
    "requested_at",
    "decided_at",
    "paid_at",
    "admin_note",
    "risk_level",
    "risk_flags",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.user_id,
        row.country_code,
        String(row.credits_requested),
        String(row.cash_amount),
        row.currency,
        row.queue_status,
        row.requested_at,
        row.decided_at || "",
        row.paid_at || "",
        row.admin_note || "",
        row.risk_level,
        row.risk_flags.join("|"),
      ]
        .map((value) => csvEscape(String(value)))
        .join(",")
    );
  }

  return lines.join("\n");
}
