import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/referrals/cashouts";

const statusSchema = z.enum(["pending", "approved", "rejected", "paid", "void"]);

type CashoutRow = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  rate_used: number;
  status: "pending" | "approved" | "rejected" | "paid" | "void";
  admin_note: string | null;
  payout_reference: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const adminClient = createServiceRoleClient();

  const statusParam = request.nextUrl.searchParams.get("status");
  const countryParam = request.nextUrl.searchParams.get("country_code")?.trim().toUpperCase();
  const userParam = request.nextUrl.searchParams.get("user_id")?.trim();
  const limitParam = Number(request.nextUrl.searchParams.get("limit") || 100);
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(500, Math.trunc(limitParam)))
    : 100;

  let query = adminClient
    .from("referral_cashout_requests")
    .select(
      "id, user_id, country_code, credits_requested, cash_amount, currency, rate_used, status, admin_note, payout_reference, requested_at, decided_at, paid_at"
    )
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (statusParam) {
    const parsedStatus = statusSchema.safeParse(statusParam);
    if (!parsedStatus.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 422 });
    }
    query = query.eq("status", parsedStatus.data);
  }

  if (countryParam) {
    query = query.eq("country_code", countryParam);
  }

  if (userParam) {
    query = query.eq("user_id", userParam);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data as CashoutRow[] | null) ?? [];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));

  let profileMap = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    profileMap = new Map(
      ((profiles as ProfileRow[] | null) ?? []).map((profile) => [profile.id, profile])
    );
  }

  return NextResponse.json({
    requests: rows.map((row) => {
      const profile = profileMap.get(row.user_id);
      return {
        ...row,
        user: {
          id: row.user_id,
          full_name: profile?.full_name ?? null,
          email: null,
        },
      };
    }),
  });
}
