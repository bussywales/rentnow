import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, getUserRole } from "@/lib/authz";
import { DEFAULT_JURISDICTION } from "@/lib/legal/constants";
import { getLegalAcceptanceStatus } from "@/lib/legal/acceptance.server";
import { isLegalContentEmpty } from "@/lib/legal/markdown";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const acceptSchema = z.object({
  jurisdiction: z.string().trim().min(2).max(10).optional(),
});

function resolveIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip");
}

type AcceptDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  getLegalAcceptanceStatus: typeof getLegalAcceptanceStatus;
};

export async function postLegalAcceptResponse(
  request: Request,
  deps: AcceptDeps
): Promise<NextResponse> {
  const startTime = Date.now();
  const routeLabel = "/api/legal/accept";

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(auth.supabase, auth.user.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = acceptSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const jurisdiction = (body.data.jurisdiction || DEFAULT_JURISDICTION).toUpperCase();

  const status = await deps.getLegalAcceptanceStatus({
    userId: auth.user.id,
    role,
    jurisdiction,
    supabase: auth.supabase,
  });

  if (status.documents.length === 0) {
    return NextResponse.json({ error: "No published legal documents available" }, { status: 409 });
  }

  if (status.missingAudiences.length > 0) {
    return NextResponse.json(
      {
        error: "Required legal documents are missing or unpublished",
        missing_audiences: status.missingAudiences,
      },
      { status: 409 }
    );
  }

  const hasEmptyDoc = status.documents.some((doc) => isLegalContentEmpty(doc.content_md));
  if (hasEmptyDoc) {
    return NextResponse.json({ error: "Legal document content is empty" }, { status: 400 });
  }

  const ip = resolveIp(request);
  const userAgent = request.headers.get("user-agent");
  const now = new Date().toISOString();

  const payload = status.documents.map((doc) => ({
    user_id: auth.user.id,
    document_id: doc.id,
    jurisdiction,
    audience: doc.audience,
    version: doc.version,
    accepted_at: now,
    ip,
    user_agent: userAgent,
  }));

  const { error } = await auth.supabase
    .from("legal_acceptances")
    .upsert(payload, { onConflict: "user_id,jurisdiction,audience,version" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, accepted_at: now, jurisdiction });
}

export async function POST(request: Request) {
  return postLegalAcceptResponse(request, {
    hasServerSupabaseEnv,
    requireUser,
    getUserRole,
    getLegalAcceptanceStatus,
  });
}
