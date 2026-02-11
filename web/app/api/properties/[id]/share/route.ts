import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchUserRole } from "@/lib/auth/role";
import {
  isUuid,
  logPropertyEvent,
  resolveEventSessionKey,
} from "@/lib/analytics/property-events.server";
import {
  PROPERTY_SHARE_CHANNELS,
  PROPERTY_SHARE_SURFACES,
  buildPropertyShareMeta,
} from "@/lib/properties/public-share";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/properties/[id]/share";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const payloadSchema = z.object({
  channel: z.enum(PROPERTY_SHARE_CHANNELS),
  surface: z.enum(PROPERTY_SHARE_SURFACES),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase not configured.", route: routeLabel },
      { status: 503 }
    );
  }

  const { id } = paramsSchema.parse(await context.params);
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid listing id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid share payload." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user ? await fetchUserRole(supabase, user.id) : null;

  const logged = await logPropertyEvent({
    supabase,
    propertyId: id,
    eventType: "agent_network_shared",
    actorUserId: user?.id ?? null,
    actorRole: role ?? "anon",
    sessionKey: resolveEventSessionKey({
      request,
      userId: user?.id ?? null,
    }),
    meta: buildPropertyShareMeta({
      channel: parsed.data.channel,
      surface: parsed.data.surface,
    }),
  });

  return NextResponse.json({ ok: true, logged: logged.ok });
}
