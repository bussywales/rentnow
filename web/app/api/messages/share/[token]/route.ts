import { NextResponse } from "next/server";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";

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
  const { data, error } = await supabase.rpc("get_message_thread_share", {
    p_token: token,
  });

  if (error || !data) {
    return NextResponse.json({ error: "Share link is invalid or expired." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...data });
}
