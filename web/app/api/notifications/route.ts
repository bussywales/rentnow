import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";

const routeLabel = "/api/notifications";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  is_read: boolean;
  created_at: string;
};

type QueryClient = {
  from: (table: "notifications") => {
    select: (
      columns: string,
      options?: { count?: "exact"; head?: boolean }
    ) => {
      eq: (
        column: "user_id" | "is_read",
        value: string | boolean
      ) => {
        order?: (
          column: "created_at",
          options?: { ascending?: boolean }
        ) => {
          limit: (value: number) => Promise<{
            data: NotificationRow[] | null;
            error: { message?: string | null } | null;
          }>;
        };
        eq?: (
          column: "is_read",
          value: boolean
        ) => Promise<{ count: number | null; error: { message?: string | null } | null }>;
      };
    };
  };
};

async function listNotificationsForUser(client: QueryClient, userId: string, limit: number) {
  const query = client
    .from("notifications")
    .select("id,type,title,body,href,is_read,created_at")
    .eq("user_id", userId);

  const ordered = query.order?.("created_at", { ascending: false });
  if (!ordered) return { data: [], error: null };

  const { data, error } = await ordered.limit(limit);
  return {
    data: data ?? [],
    error,
  };
}

async function countUnreadForUser(client: QueryClient, userId: string) {
  const query = client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const result = await query.eq?.("is_read", false);
  if (!result) return { unreadCount: 0, error: null };

  return {
    unreadCount: result.count ?? 0,
    error: result.error,
  };
}

export type NotificationsRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireUser: typeof requireUser;
  listNotificationsForUser: typeof listNotificationsForUser;
  countUnreadForUser: typeof countUnreadForUser;
};

const defaultDeps: NotificationsRouteDeps = {
  hasServerSupabaseEnv,
  requireUser,
  listNotificationsForUser,
  countUnreadForUser,
};

export async function getNotificationsResponse(
  request: NextRequest,
  deps: NotificationsRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });
  const limit = parsed.success ? parsed.data.limit ?? 20 : 20;

  try {
    const [listResult, countResult] = await Promise.all([
      deps.listNotificationsForUser(auth.supabase as unknown as QueryClient, auth.user.id, limit),
      deps.countUnreadForUser(auth.supabase as unknown as QueryClient, auth.user.id),
    ]);

    if (listResult.error) {
      return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
    }
    if (countResult.error) {
      return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
    }

    return NextResponse.json({
      notifications: listResult.data,
      unreadCount: countResult.unreadCount,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return getNotificationsResponse(request);
}
