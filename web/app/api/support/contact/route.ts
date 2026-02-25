import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { enforceSupportRateLimit } from "@/lib/security/rate-limit";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const payloadSchema = z.object({
  category: z.enum(["general", "account", "listing", "safety", "billing"]),
  name: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  message: z.string().min(10).max(2000),
});

export type SupportContactDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  getServerAuthUser: typeof getServerAuthUser;
  enforceSupportRateLimit: typeof enforceSupportRateLimit;
};

const defaultDeps: SupportContactDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServiceRoleClient,
  createServerSupabaseClient,
  getServerAuthUser,
  enforceSupportRateLimit,
};

export async function postSupportContactResponse(
  request: Request,
  deps: SupportContactDeps = defaultDeps
) {
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Support is unavailable." }, { status: 503 });
  }

  const body = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { user } = await deps.getServerAuthUser();
  const rateLimit = await deps.enforceSupportRateLimit({
    client: deps.hasServiceRoleEnv()
      ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
      : null,
    request,
    routeKey: "support_contact",
    userId: user?.id ?? null,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many support requests. Please wait before trying again.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const supabase = deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : await deps.createServerSupabaseClient();

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

export async function POST(request: Request) {
  return postSupportContactResponse(request, defaultDeps);
}
