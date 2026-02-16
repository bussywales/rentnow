import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";

const routeLabel = "/api/notifications/mark-read";

const payloadSchema = z.object({
  ids: z.array(z.string().uuid()).max(50).optional(),
});

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
        eq?: (
          column: "is_read",
          value: boolean
        ) => Promise<{ count: number | null; error: { message?: string | null } | null }>;
      };
    };
    update: (row: { is_read: boolean }) => {
      eq: (
        column: "user_id" | "is_read",
        value: string | boolean
      ) => {
        eq?: (
          column: "is_read",
          value: boolean
        ) => {
          in?: (
            column: "id",
            ids: string[]
          ) => {
            select: (columns: string) => Promise<{
              data: Array<{ id: string }> | null;
              error: { message?: string | null } | null;
            }>;
          };
          select?: (columns: string) => Promise<{
            data: Array<{ id: string }> | null;
            error: { message?: string | null } | null;
          }>;
        };
      };
    };
  };
};

export async function markNotificationsRead(
  client: QueryClient,
  userId: string,
  ids?: string[]
) {
  const root = client.from("notifications").update({ is_read: true }).eq("user_id", userId);
  const unread = root.eq?.("is_read", false);

  if (!unread) {
    return { updatedIds: [], error: null };
  }

  if (ids?.length) {
    const filtered = unread.in?.("id", ids);
    if (!filtered) return { updatedIds: [], error: null };
    const { data, error } = await filtered.select("id");
    return {
      updatedIds: (data ?? []).map((row) => row.id),
      error,
    };
  }

  const selector = unread.select;
  if (!selector) {
    return { updatedIds: [], error: null };
  }
  const { data, error } = await selector("id");
  return {
    updatedIds: (data ?? []).map((row) => row.id),
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

export type NotificationsMarkReadDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireUser: typeof requireUser;
  markNotificationsRead: typeof markNotificationsRead;
  countUnreadForUser: typeof countUnreadForUser;
};

const defaultDeps: NotificationsMarkReadDeps = {
  hasServerSupabaseEnv,
  requireUser,
  markNotificationsRead,
  countUnreadForUser,
};

export async function postNotificationsMarkReadResponse(
  request: NextRequest,
  deps: NotificationsMarkReadDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const parsed = payloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const result = await deps.markNotificationsRead(
    auth.supabase as unknown as QueryClient,
    auth.user.id,
    parsed.data.ids
  );

  if (result.error) {
    return NextResponse.json({ error: "Unable to mark notifications as read" }, { status: 500 });
  }

  const unreadResult = await deps.countUnreadForUser(
    auth.supabase as unknown as QueryClient,
    auth.user.id
  );
  if (unreadResult.error) {
    return NextResponse.json({ error: "Unable to mark notifications as read" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, unreadCount: unreadResult.unreadCount });
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return postNotificationsMarkReadResponse(request);
}
