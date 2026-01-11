import { NextResponse } from "next/server";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import type { ShareLinkStatus } from "@/lib/messaging/share";
import { logShareAccess } from "@/lib/messaging/share-logging";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Messaging is unavailable." }, { status: 503 });
  }

  const params = await context.params;
  const token = params?.token;
  if (!token) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logShareAccess({ result: "unauthenticated" });
    return NextResponse.json(
      { error: "Sign in to continue.", code: "not_authenticated" },
      { status: 401 }
    );
  }
  const { data, error } = await supabase.rpc("get_message_thread_share", {
    p_token: token,
  });

  if (error || !data) {
    logShareAccess({
      result: "invalid",
      actorProfileId: user.id,
    });
    return NextResponse.json(
      { error: "Share link is invalid or expired.", status: "invalid" },
      { status: 404 }
    );
  }

  const status = (data?.status as ShareLinkStatus)
    ?? (Array.isArray(data?.messages) ? "active" : "invalid");
  logShareAccess({
    result: status === "active" ? "ok" : status,
    actorProfileId: user.id,
    propertyId: data?.property_id ?? null,
    tenantId: data?.tenant_id ?? null,
  });
  return NextResponse.json({ ok: status === "active", status, ...data });
}
