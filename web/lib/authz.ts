import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import type { UserRole } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type DenyInput = {
  request: Request;
  route: string;
  startTime: number;
  status: 401 | 403;
  reason: string;
};

type RequireUserResult =
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; response: NextResponse };

type RequireRoleResult =
  | { ok: true; supabase: SupabaseClient; user: User; role: UserRole }
  | { ok: false; response: NextResponse };

type RequireOwnershipInput = {
  request: Request;
  route: string;
  startTime: number;
  resourceOwnerId?: string | null;
  userId: string;
  role?: UserRole | null;
  allowRoles?: UserRole[];
};

function deny({ request, route, startTime, status, reason }: DenyInput) {
  logFailure({
    request,
    route,
    status,
    startTime,
    level: "warn",
    error: `deny:${reason}`,
  });
  const message = status === 401 ? "Unauthorized" : "Forbidden";
  return NextResponse.json({ error: message }, { status });
}

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (profile?.role as UserRole) ?? null;
}

export async function requireUser({
  request,
  route,
  startTime,
  supabase: existingSupabase,
  accessToken,
}: {
  request: Request;
  route: string;
  startTime: number;
  supabase?: SupabaseClient;
  accessToken?: string | null;
}): Promise<RequireUserResult> {
  const supabase = existingSupabase ?? (await createServerSupabaseClient());
  const userResult = accessToken
    ? await supabase.auth.getUser(accessToken)
    : await supabase.auth.getUser();
  const {
    data: { user },
    error,
  } = userResult;

  if (error || !user) {
    return { ok: false, response: deny({ request, route, startTime, status: 401, reason: "missing_user" }) };
  }

  return { ok: true, supabase, user };
}

export async function requireRole({
  request,
  route,
  startTime,
  roles,
  supabase: existingSupabase,
}: {
  request: Request;
  route: string;
  startTime: number;
  roles: UserRole[];
  supabase?: SupabaseClient;
}): Promise<RequireRoleResult> {
  const auth = await requireUser({
    request,
    route,
    startTime,
    supabase: existingSupabase,
  });
  if (!auth.ok) return auth;

  const role = await getUserRole(auth.supabase, auth.user.id);
  if (!role) {
    return { ok: false, response: deny({ request, route, startTime, status: 403, reason: "role_missing" }) };
  }

  if (!roles.includes(role)) {
    return { ok: false, response: deny({ request, route, startTime, status: 403, reason: "role_forbidden" }) };
  }

  return { ok: true, supabase: auth.supabase, user: auth.user, role };
}

export function requireOwnership({
  request,
  route,
  startTime,
  resourceOwnerId,
  userId,
  role,
  allowRoles = ["admin"],
}: RequireOwnershipInput): { ok: true } | { ok: false; response: NextResponse } {
  if (role && allowRoles.includes(role)) {
    return { ok: true };
  }
  if (!resourceOwnerId || resourceOwnerId !== userId) {
    return { ok: false, response: deny({ request, route, startTime, status: 403, reason: "ownership_mismatch" }) };
  }
  return { ok: true };
}
