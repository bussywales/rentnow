import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/push/unsubscribe";

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: Request) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid unsubscribe payload." },
      { status: 400 }
    );
  }

  const { error } = await auth.supabase
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", auth.user.id)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
