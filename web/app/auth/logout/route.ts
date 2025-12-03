import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout error", err);
  }
  const url = new URL("/", request.url);
  return NextResponse.redirect(url);
}
