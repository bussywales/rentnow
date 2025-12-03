import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ ready: false, user: null, error: "missing env" });
  }

  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json({ ready: true, user: null, error: error.message });
    }

    return NextResponse.json({ ready: true, user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ready: true, user: null, error: message });
  }
}
