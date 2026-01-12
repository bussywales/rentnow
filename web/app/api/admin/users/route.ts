import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
const routeLabel = "/api/admin/users";

type ListUsersResult = {
  data: { users: unknown[] | null } | null;
  error: { message: string } | null;
};

type AdminUsersDeps = {
  hasServiceRoleEnv?: () => boolean;
  requireRole?: typeof requireRole;
  listUsers?: () => Promise<ListUsersResult>;
  sendResetEmail?: (email: string, redirectTo: string) => Promise<{ error: { message: string } | null }>;
  deleteUser?: (userId: string) => Promise<{ error: { message: string } | null }>;
};

const getPublicClient = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  });
};

export async function getAdminUsersResponse(request: Request, deps: AdminUsersDeps = {}) {
  const startTime = Date.now();
  const {
    hasServiceRoleEnv: hasServiceRoleEnvImpl = hasServiceRoleEnv,
    requireRole: requireRoleImpl = requireRole,
    listUsers = async () => {
      const adminClient = createServiceRoleClient();
      return adminClient.auth.admin.listUsers({ perPage: 200 });
    },
  } = deps;
  if (!hasServiceRoleEnvImpl()) {
    return NextResponse.json(
      { error: "Service role key missing; user admin API unavailable." },
      { status: 503 }
    );
  }
  const auth = await requireRoleImpl({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const { data, error } = await listUsers();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ users: data?.users || [] });
}

export async function GET(request: Request) {
  return getAdminUsersResponse(request);
}

export async function postAdminUsersResponse(request: Request, deps: AdminUsersDeps = {}) {
  const startTime = Date.now();
  const {
    hasServiceRoleEnv: hasServiceRoleEnvImpl = hasServiceRoleEnv,
    requireRole: requireRoleImpl = requireRole,
    sendResetEmail = async (email: string, redirectTo: string) => {
      const client = getPublicClient();
      if (!client) {
        return { error: { message: "Supabase anon key missing; reset email unavailable." } };
      }
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      return { error: error ? { message: error.message } : null };
    },
    deleteUser = async (userId: string) => {
      const adminClient = createServiceRoleClient();
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      return { error: error ? { message: error.message } : null };
    },
  } = deps;

  if (!hasServiceRoleEnvImpl()) {
    return NextResponse.json(
      { error: "Service role key missing; user admin API unavailable." },
      { status: 503 }
    );
  }
  const auth = await requireRoleImpl({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const payload = await request.json().catch(() => ({}));
  const { action, userId, email } = payload as {
    action?: "delete" | "reset_password";
    userId?: string;
    email?: string;
  };
  if (!action || !userId) {
    return NextResponse.json({ error: "Missing action or userId" }, { status: 400 });
  }
  if (action === "delete") {
    const { error } = await deleteUser(userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "reset_password") {
    if (!email) {
      return NextResponse.json({ error: "Email required for reset link" }, { status: 400 });
    }
    const siteUrl = await getSiteUrl({ allowFallback: true });
    const redirectTo = siteUrl
      ? `${siteUrl.replace(/\/$/, "")}/auth/reset?from=reset_email`
      : "/auth/reset?from=reset_email";
    const { error } = await sendResetEmail(email, redirectTo);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

export async function POST(request: Request) {
  return postAdminUsersResponse(request);
}
