import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { ensureAgentSlugForUser } from "@/lib/agents/agent-storefront.server";
import { ensurePublicSlugForUser } from "@/lib/advertisers/public-slug.server";

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
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;
  const bio = typeof body?.bio === "string" ? body.bio : null;

  const slug = await ensureAgentSlugForUser({
    userId: auth.user.id,
    displayName,
    force,
    enabled,
    bio,
  });
  const publicSlug = await ensurePublicSlugForUser({
    userId: auth.user.id,
    displayName,
  });

  if (!slug && enabled !== false) {
    return NextResponse.json(
      { error: "Unable to generate storefront slug." },
      { status: 500 }
    );
  }

  return NextResponse.json({ slug, publicSlug });
}
