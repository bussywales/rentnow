import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";

const payloadSchema = z.object({
  category: z.enum(["general", "account", "listing", "safety", "billing"]),
  name: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  message: z.string().min(10).max(2000),
});

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Support is unavailable." }, { status: 503 });
  }

  const body = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { user } = await getServerAuthUser();
  const supabase = hasServiceRoleEnv() ? createServiceRoleClient() : await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      user_id: user?.id ?? null,
      category: body.data.category,
      name: body.data.name ?? null,
      email: body.data.email ?? user?.email ?? null,
      message: body.data.message,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
