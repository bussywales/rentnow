import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getReferralDashboardSnapshot } from "@/lib/referrals/referrals.server";
import {
  claimReferralMilestoneBonus,
  getReferralMilestoneStatusesForUser,
} from "@/lib/referrals/milestones.server";
import { getReferralWalletSnapshot } from "@/lib/referrals/cashout";
import { getReferralSettings, resolveReferralTierStatus } from "@/lib/referrals/settings";

const routeLabel = "/api/referrals/milestones/claim";

const requestSchema = z.object({
  milestoneId: z.string().uuid(),
});

function mapFailureStatus(reason: string) {
  if (reason === "MILESTONE_NOT_FOUND") return 404;
  if (reason === "MILESTONE_DISABLED") return 403;
  if (reason === "THRESHOLD_NOT_MET") return 409;
  return 400;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const adminClient = createServiceRoleClient() as unknown as SupabaseClient;
  const settings = await getReferralSettings(adminClient);

  if (!settings.milestonesEnabled) {
    return NextResponse.json({ ok: false, reason: "MILESTONES_DISABLED" }, { status: 403 });
  }

  const snapshot = await getReferralDashboardSnapshot({
    client: adminClient,
    userId: auth.user.id,
    maxDepth: settings.maxDepth,
  });

  const claimResult = await claimReferralMilestoneBonus({
    client: adminClient,
    userId: auth.user.id,
    milestoneId: parsed.data.milestoneId,
    activeReferralsCount: snapshot.verifiedReferrals,
  });

  if (!claimResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: claimResult.reason,
      },
      { status: mapFailureStatus(claimResult.reason) }
    );
  }

  const [wallet, milestones] = await Promise.all([
    getReferralWalletSnapshot(adminClient, auth.user.id),
    getReferralMilestoneStatusesForUser({
      client: adminClient,
      userId: auth.user.id,
      activeReferralsCount: snapshot.verifiedReferrals,
      includeDisabled: false,
    }),
  ]);

  const tier = resolveReferralTierStatus(snapshot.verifiedReferrals, settings.tierThresholds);

  return NextResponse.json({
    ok: true,
    claim: {
      milestoneId: claimResult.milestone.id,
      alreadyClaimed: claimResult.alreadyClaimed,
      bonusCredits: claimResult.milestone.bonus_credits,
    },
    dashboard: {
      activeReferrals: snapshot.verifiedReferrals,
      tier,
      wallet,
      milestones,
    },
  });
}
