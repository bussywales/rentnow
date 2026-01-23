import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import {
  normalizeReasons,
  serializeRequestChangesPayload,
  validateRequestChangesPayload,
} from "@/lib/admin/admin-review-rubric";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing", code: "SERVER_ERROR" }, { status: 503 });
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "ADMIN_REVIEW_NOT_ALLOWED" },
      { status: 401 }
    );
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden", code: "ADMIN_REVIEW_NOT_ALLOWED" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reasons = normalizeReasons(body?.reasons);
  const validation = validateRequestChangesPayload(reasons, body?.message);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error || "Invalid request", code: "ADMIN_REVIEW_INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { data: property } = await supabase.from("properties").select("id,status").eq("id", id).maybeSingle();
  if (!property) {
    return NextResponse.json({ error: "Not found", code: "ADMIN_REVIEW_NOT_FOUND" }, { status: 404 });
  }
  if (property.status && property.status !== "pending") {
    return NextResponse.json(
      { error: "Listing already processed", code: "ADMIN_REVIEW_ALREADY_PROCESSED" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const rejection_reason = serializeRequestChangesPayload(reasons, validation.message, user.id);
  const { error } = await supabase
    .from("properties")
    .update({
      status: "changes_requested",
      is_approved: false,
      is_active: false,
      rejected_at: now,
      rejection_reason,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to update", code: "SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, status: "changes_requested" });
}
