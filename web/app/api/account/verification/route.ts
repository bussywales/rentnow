import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getVerificationRequirements } from "@/lib/settings/app-settings.server";
import { getVerificationStatus } from "@/lib/verification/status";
import { buildVerificationCenterState } from "@/lib/verification/center";

const routeLabel = "/api/account/verification";

type AccountVerificationDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getVerificationStatus: typeof getVerificationStatus;
  getVerificationRequirements: typeof getVerificationRequirements;
};

const defaultDeps: AccountVerificationDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getVerificationStatus,
  getVerificationRequirements,
};

export async function getAccountVerificationResponse(
  request: Request,
  deps: AccountVerificationDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({
    request,
    route: routeLabel,
    startTime,
    supabase,
  });
  if (!auth.ok) return auth.response;

  const [status, requirements] = await Promise.all([
    deps.getVerificationStatus({ userId: auth.user.id }),
    deps.getVerificationRequirements(auth.supabase),
  ]);
  const center = buildVerificationCenterState({ status, requirements });

  return NextResponse.json({
    emailVerified: status.email.verified === true,
    phoneVerified: status.phone.verified === true,
    bankVerified: status.bank.verified === true,
    requireEmail: requirements.requireEmail,
    requirePhone: requirements.requirePhone,
    requireBank: requirements.requireBank,
    requiredChecksCompleted: center.completion.requiredCompleted,
    requiredChecksTotal: center.completion.requiredTotal,
    isVerificationComplete: center.completion.isComplete,
  });
}

export async function GET(request: Request) {
  return getAccountVerificationResponse(request);
}
