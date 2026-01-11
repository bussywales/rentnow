import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
const routeLabel = "/api/admin/users";

type ListUsersResult = {
  data: { users: unknown[] | null } | null;
  error: { message: string } | null;
};

type AdminUsersDeps = {
  hasServiceRoleEnv?: () => boolean;
  requireRole?: typeof requireRole;
  listUsers?: () => Promise<ListUsersResult>;
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

export async function POST(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; user admin API unavailable." },
      { status: 503 }
    );
  }
  const auth = await requireRole({
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
