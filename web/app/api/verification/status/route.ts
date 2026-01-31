import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { getVerificationStatus } from "@/lib/verification/status";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const { user } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getVerificationStatus({ userId: user.id });
  return NextResponse.json({ ok: true, status });
}
