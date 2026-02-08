import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { markAgentSharedPageComplete } from "@/lib/agents/agent-onboarding.server";

const routeLabel = "/api/agent/onboarding/share-complete";

export type AgentOnboardingShareDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  markAgentSharedPageComplete: typeof markAgentSharedPageComplete;
};

const defaultDeps: AgentOnboardingShareDeps = {
  hasServerSupabaseEnv,
  requireRole,
  markAgentSharedPageComplete,
};

export async function postAgentShareCompleteResponse(
  request: Request,
  deps: AgentOnboardingShareDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent"],
  });
  if (!auth.ok) return auth.response;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.propatyhub.com";
  const progress = await deps.markAgentSharedPageComplete({
    supabase: auth.supabase,
    userId: auth.user.id,
    agentSlug: null,
    siteUrl,
  });

  return NextResponse.json({
    ok: true,
    progress: {
      hasListing: progress.hasListing,
      hasClientPage: progress.hasClientPage,
      hasSharedPage: progress.hasSharedPage,
      completed: progress.completed,
      completedAt: progress.completedAt,
    },
  });
}

export async function POST(request: Request) {
  return postAgentShareCompleteResponse(request);
}
