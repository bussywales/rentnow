import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { ensureAgentSlugForUser } from "@/lib/agents/agent-storefront.server";

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: "api/profile/agent-storefront",
    startTime,
    roles: ["agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const displayName = typeof body?.displayName === "string" ? body.displayName : null;
  const force = body?.force === true;

  const slug = await ensureAgentSlugForUser({
    userId: auth.user.id,
    displayName,
    force,
  });

  if (!slug) {
    return NextResponse.json(
      { error: "Unable to generate storefront slug." },
      { status: 500 }
    );
  }

  return NextResponse.json({ slug });
}
