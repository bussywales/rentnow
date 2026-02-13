import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  syncProductUpdateDraftsFromDocs,
  type ProductUpdatesSyncSummary,
} from "@/lib/product-updates/sync.server";

const routeLabel = "/api/admin/product-updates/sync";

type MinimalClient = {
  from: (table: string) => unknown;
};

export type ProductUpdatesSyncRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: () => MinimalClient;
  requireRole: typeof requireRole;
  getCronSecret: () => string;
  syncProductUpdateDraftsFromDocs: (input: {
    client: MinimalClient;
    actorId: string | null;
  }) => Promise<ProductUpdatesSyncSummary>;
};

const defaultDeps: ProductUpdatesSyncRouteDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
  getCronSecret: () => process.env.CRON_SECRET || "",
  syncProductUpdateDraftsFromDocs: ({ client, actorId }) =>
    syncProductUpdateDraftsFromDocs({ client: client as never, actorId }),
};

function hasValidCronSecret(request: NextRequest, expectedSecret: string) {
  if (!expectedSecret) return false;
  return request.headers.get("x-cron-secret") === expectedSecret;
}

export async function postAdminProductUpdatesSyncResponse(
  request: NextRequest,
  deps: ProductUpdatesSyncRouteDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const secretOk = hasValidCronSecret(request, deps.getCronSecret());

  let actorId: string | null = null;
  let client: MinimalClient;

  if (secretOk) {
    if (!deps.hasServiceRoleEnv()) {
      return NextResponse.json({ error: "Service role env missing" }, { status: 503 });
    }
    client = deps.createServiceRoleClient();
  } else {
    const auth = await deps.requireRole({
      request,
      route: routeLabel,
      startTime,
      roles: ["admin"],
    });
    if (!auth.ok) return auth.response;

    actorId = auth.user.id;
    client = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : auth.supabase;
  }

  try {
    const summary = await deps.syncProductUpdateDraftsFromDocs({ client, actorId });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync product updates";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return postAdminProductUpdatesSyncResponse(request);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
