import { NextResponse } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function ensureAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const };
}

export async function GET() {
  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; user admin API unavailable." },
      { status: 503 }
    );
  }
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const adminClient = createServiceRoleClient();
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ users: data.users || [] });
}

export async function POST(request: Request) {
  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; user admin API unavailable." },
      { status: 503 }
    );
  }
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const payload = await request.json().catch(() => ({}));
  const { action, userId, email } = payload as {
    action?: "delete" | "reset_password";
    userId?: string;
    email?: string;
  };
  if (!action || !userId) {
    return NextResponse.json({ error: "Missing action or userId" }, { status: 400 });
  }
  const adminClient = createServiceRoleClient();
  if (action === "delete") {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "reset_password") {
    if (!email) {
      return NextResponse.json({ error: "Email required for reset link" }, { status: 400 });
    }
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Supabase returns properties + user; action link on properties if configured
    const link = (data as unknown as { properties?: { action_link?: string } })?.properties
      ?.action_link;
    return NextResponse.json({ ok: true, link: link || null });
  }
  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
