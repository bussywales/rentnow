import { NextResponse, type NextRequest } from "next/server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/shortlet/bookings/pending-count";

type QueryClient = {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { count?: "exact"; head?: boolean }
    ) => QueryBuilder;
  };
};

type QueryBuilder = {
  eq: (column: string, value: string) => QueryBuilder;
  in: (column: string, values: string[]) => Promise<{
    count: number | null;
    error: { message?: string } | null;
  }>;
  limit: (value: number) => Promise<{ data: Array<Record<string, unknown>> | null }>;
};

type CountQueryResult = {
  count: number | null;
  error: { message?: string } | null;
};

type ListQueryResult = { data: Array<Record<string, unknown>> | null };

async function listOwnedShortletPropertyIds(client: QueryClient, ownerId: string) {
  const result = await (
    client
      .from("properties")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("listing_intent", "shortlet")
      .limit(500) as Promise<ListQueryResult>
  );

  const rows = result.data ?? [];
  return rows
    .map((row) => String(row.id || ""))
    .filter(Boolean);
}

async function countPendingForProperties(client: QueryClient, propertyIds: string[]) {
  if (!propertyIds.length) return 0;

  const result = await (
    client
      .from("shortlet_bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .in("property_id", propertyIds) as Promise<CountQueryResult>
  );

  if (result.error) {
    throw new Error(result.error.message || "Unable to load pending count");
  }
  return result.count ?? 0;
}

export type ShortletPendingCountDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  readActingAsFromRequest: typeof readActingAsFromRequest;
  hasActiveDelegation: typeof hasActiveDelegation;
  hasServiceRoleEnv?: typeof hasServiceRoleEnv;
  createServiceRoleClient?: typeof createServiceRoleClient;
  listOwnedShortletPropertyIds: typeof listOwnedShortletPropertyIds;
  countPendingForProperties: typeof countPendingForProperties;
};

const defaultDeps: ShortletPendingCountDeps = {
  hasServerSupabaseEnv,
  requireRole,
  readActingAsFromRequest,
  hasActiveDelegation,
  hasServiceRoleEnv,
  createServiceRoleClient,
  listOwnedShortletPropertyIds,
  countPendingForProperties,
};

export async function getShortletPendingCountResponse(
  request: NextRequest,
  deps: ShortletPendingCountDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  if (auth.role === "tenant" || auth.role === "admin") {
    return NextResponse.json({ ok: true, pendingCount: 0 });
  }

  let ownerId = auth.user.id;
  if (auth.role === "agent") {
    const actingAs = deps.readActingAsFromRequest(request);
    if (actingAs && actingAs !== auth.user.id) {
      const allowed = await deps.hasActiveDelegation(auth.supabase, auth.user.id, actingAs);
      if (allowed) {
        ownerId = actingAs;
      }
    }
  }

  try {
    const canUseServiceRole = !!deps.hasServiceRoleEnv?.() && !!deps.createServiceRoleClient;
    const shouldUseServiceRole = canUseServiceRole && ownerId !== auth.user.id;
    const queryClient = shouldUseServiceRole
      ? (deps.createServiceRoleClient!() as unknown as QueryClient)
      : (auth.supabase as unknown as QueryClient);

    const propertyIds = await deps.listOwnedShortletPropertyIds(
      queryClient,
      ownerId
    );

    if (!propertyIds.length) {
      return NextResponse.json({ ok: true, pendingCount: 0 });
    }

    const pendingCount = await deps.countPendingForProperties(
      queryClient,
      propertyIds
    );

    return NextResponse.json({ ok: true, pendingCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load pending count";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return getShortletPendingCountResponse(request);
}
