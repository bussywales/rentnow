import { NextResponse } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { isValidSavedSearchUnsubscribeToken } from "@/lib/saved-searches/alerts.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

function buildRedirect(request: Request, status: "ok" | "invalid" | "error") {
  const url = new URL("/saved-searches", request.url);
  url.searchParams.set("alerts", status);
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Saved search alerts are unavailable." }, { status: 503 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!id || !token) {
    return buildRedirect(request, "invalid");
  }

  const supabase = createServiceRoleClient() as unknown as UntypedAdminClient;
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id,user_id")
    .eq("id", id)
    .maybeSingle();

  if (
    error ||
    !data ||
    typeof (data as { user_id?: string }).user_id !== "string"
  ) {
    return buildRedirect(request, "invalid");
  }
  const userId = (data as { user_id: string }).user_id;

  const isValid = isValidSavedSearchUnsubscribeToken({
    searchId: id,
    userId,
    token,
  });
  if (!isValid) {
    return buildRedirect(request, "invalid");
  }

  const { error: updateError } = await supabase
    .from("saved_searches")
    .update({
      alerts_enabled: false,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) {
    return buildRedirect(request, "error");
  }

  return buildRedirect(request, "ok");
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
