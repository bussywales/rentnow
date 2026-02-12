import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  fetchAdminCashoutQueue,
  parseAdminCashoutQueueFilters,
  validateCashoutActionTransition,
} from "@/lib/referrals/cashout-admin.server";
import { evaluateCashoutRisk } from "@/lib/referrals/cashout-risk.server";

const routeLabel = "/api/admin/referrals/cashouts";

const bulkSchema = z.object({
  action: z.enum(["bulk_approve", "bulk_reject"]),
  request_ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().trim().max(5000).optional().nullable(),
});

type RawRequestRow = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "paid" | "void";
};

export type AdminReferralCashoutsRouteDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  parseAdminCashoutQueueFilters: typeof parseAdminCashoutQueueFilters;
  fetchAdminCashoutQueue: typeof fetchAdminCashoutQueue;
  evaluateCashoutRisk: typeof evaluateCashoutRisk;
  validateCashoutActionTransition: typeof validateCashoutActionTransition;
};

const defaultDeps: AdminReferralCashoutsRouteDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  parseAdminCashoutQueueFilters,
  fetchAdminCashoutQueue,
  evaluateCashoutRisk,
  validateCashoutActionTransition,
};

function queueStatusFromRisk(input: {
  status: RawRequestRow["status"];
  requiresManualApproval: boolean;
  riskLevel: "none" | "low" | "medium" | "high";
}) {
  if (
    input.status === "pending" &&
    (input.requiresManualApproval || input.riskLevel === "medium" || input.riskLevel === "high")
  ) {
    return "held" as const;
  }
  return input.status;
}

export async function getAdminReferralCashoutsResponse(
  request: NextRequest,
  deps: AdminReferralCashoutsRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const adminClient = deps.createServiceRoleClient() as unknown as SupabaseClient;
  const filters = deps.parseAdminCashoutQueueFilters(request.nextUrl.searchParams);
  const requests = await deps.fetchAdminCashoutQueue({
    client: adminClient,
    filters,
  });

  return NextResponse.json({ ok: true, requests });
}

export async function postAdminReferralCashoutsResponse(
  request: NextRequest,
  deps: AdminReferralCashoutsRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const adminClient = deps.createServiceRoleClient() as unknown as SupabaseClient;
  const ids = Array.from(new Set(parsed.data.request_ids));
  const reason = String(parsed.data.reason || "").trim();

  const { data: rows } = await adminClient
    .from("referral_cashout_requests")
    .select("id, user_id, country_code, credits_requested, cash_amount, currency, status")
    .in("id", ids);

  const requests = (rows as RawRequestRow[] | null) ?? [];
  if (requests.length !== ids.length) {
    return NextResponse.json({ error: "One or more requests were not found." }, { status: 404 });
  }

  const countryCodes = Array.from(
    new Set(requests.map((row) => String(row.country_code || "").trim().toUpperCase()).filter(Boolean))
  );
  const { data: policies } = countryCodes.length
    ? await adminClient
        .from("referral_jurisdiction_policies")
        .select("country_code, requires_manual_approval")
        .in("country_code", countryCodes)
    : { data: [] };
  const manualMap = new Map<string, boolean>();
  for (const row of ((policies as Array<{ country_code: string; requires_manual_approval: boolean | null }> | null) ??
    [])) {
    manualMap.set(String(row.country_code || "").trim().toUpperCase(), Boolean(row.requires_manual_approval));
  }

  const riskByUser = new Map<
    string,
    { risk_level: "none" | "low" | "medium" | "high"; risk_flags: string[] }
  >();
  const pendingUserIds = Array.from(
    new Set(requests.filter((row) => row.status === "pending").map((row) => row.user_id).filter(Boolean))
  );
  await Promise.all(
    pendingUserIds.map(async (userId) => {
      const first = requests.find((row) => row.user_id === userId);
      if (!first) return;
      const risk = await deps.evaluateCashoutRisk({
        client: adminClient,
        referrerOwnerId: userId,
        countryCode: first.country_code,
      });
      riskByUser.set(userId, {
        risk_level: risk.risk_level,
        risk_flags: risk.risk_flags,
      });
    })
  );

  const action = parsed.data.action === "bulk_approve" ? "approve" : "reject";
  if (action === "reject" && !reason) {
    return NextResponse.json({ error: "Reason is required for bulk rejection." }, { status: 422 });
  }

  for (const row of requests) {
    const countryCode = String(row.country_code || "").trim().toUpperCase();
    const requiresManualApproval = manualMap.get(countryCode) ?? true;
    const riskLevel = riskByUser.get(row.user_id)?.risk_level ?? "none";
    const queueStatus = queueStatusFromRisk({
      status: row.status,
      requiresManualApproval,
      riskLevel,
    });
    const transition = deps.validateCashoutActionTransition({
      action,
      currentStatus: row.status,
      queueStatus,
      reason,
      isBulk: true,
    });
    if (!transition.ok) {
      return NextResponse.json({ error: transition.reason }, { status: transition.status });
    }
  }

  const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
  for (const row of requests) {
    const { data, error } = await adminClient.rpc("admin_referral_cashout_action", {
      in_request_id: row.id,
      in_action: action,
      in_admin_note: reason || null,
      in_payout_reference: null,
    });

    if (error) {
      results.push({ id: row.id, ok: false, reason: error.message });
      continue;
    }

    const payload = (data ?? {}) as { ok?: boolean; reason?: string; status?: string };
    if (!payload.ok) {
      results.push({ id: row.id, ok: false, reason: payload.reason || "ACTION_FAILED" });
      continue;
    }

    const countryCode = String(row.country_code || "").trim().toUpperCase();
    const requiresManualApproval = manualMap.get(countryCode) ?? true;
    const risk = riskByUser.get(row.user_id) ?? { risk_level: "none", risk_flags: [] };
    const queueStatus = queueStatusFromRisk({
      status: row.status,
      requiresManualApproval,
      riskLevel: risk.risk_level,
    });

    await adminClient.from("referral_cashout_audit").insert({
      request_id: row.id,
      actor_id: auth.user.id,
      action_type: parsed.data.action === "bulk_approve" ? "cashout_bulk_approve" : "cashout_bulk_reject",
      previous_status: queueStatus,
      new_status: payload.status || (action === "approve" ? "approved" : "rejected"),
      reason: reason || null,
      meta: {
        reason: reason || null,
        previous_status: queueStatus,
        new_status: payload.status || (action === "approve" ? "approved" : "rejected"),
        risk_level: risk.risk_level,
        risk_flags: risk.risk_flags,
        country_code: countryCode,
        credits_requested: row.credits_requested,
        cash_amount: row.cash_amount,
        currency: row.currency,
      },
    });

    if (action === "reject") {
      await adminClient.from("referral_cashout_notifications").insert({
        user_id: row.user_id,
        request_id: row.id,
        type: "rejected",
        message: reason
          ? `Your cashout request was rejected: ${reason}`
          : "Your cashout request was rejected.",
      });
    }
    if (action === "approve") {
      await adminClient.from("referral_cashout_notifications").insert({
        user_id: row.user_id,
        request_id: row.id,
        type: "approved",
        message: "Your cashout request was approved and moved to payout processing.",
      });
    }

    results.push({ id: row.id, ok: true });
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length) {
    return NextResponse.json(
      {
        ok: false,
        error: `${failed.length} request(s) failed.`,
        results,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, results });
}

export async function GET(request: NextRequest) {
  return getAdminReferralCashoutsResponse(request);
}

export async function POST(request: NextRequest) {
  return postAdminReferralCashoutsResponse(request);
}
