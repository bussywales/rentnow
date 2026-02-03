import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const routeLabel = "/api/product-updates/read";

const bodySchema = z.object({
  updateId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { data: update } = await auth.supabase
    .from("product_updates")
    .select("id")
    .eq("id", payload.updateId)
    .not("published_at", "is", null)
    .maybeSingle();

  if (!update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  const { error } = await auth.supabase.from("product_update_reads").upsert(
    {
      user_id: auth.user.id,
      update_id: payload.updateId,
    },
    { onConflict: "user_id,update_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Unable to mark update as read" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
