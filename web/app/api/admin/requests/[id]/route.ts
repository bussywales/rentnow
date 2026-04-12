import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  PROPERTY_REQUEST_SELECT_COLUMNS,
  mapPropertyRequestRecord,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";
import { logOperationalEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

const adminRequestActionSchema = z.object({
  action: z.enum(["close", "expire", "remove"]),
});

type AdminAuthResult = Awaited<ReturnType<typeof getServerAuthUser>>;
type AdminRequestRecordResult = {
  data: PropertyRequestRecord | null;
  error: { message: string } | null;
};

export type AdminPropertyRequestRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  getServerAuthUser: typeof getServerAuthUser;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  loadRequest: (input: { client: AdminAuthResult["supabase"]; requestId: string }) => Promise<AdminRequestRecordResult>;
  updateRequest: (input: {
    client: AdminAuthResult["supabase"];
    requestId: string;
    updates: Record<string, unknown>;
  }) => Promise<AdminRequestRecordResult>;
  now: () => string;
};

const defaultDeps: AdminPropertyRequestRouteDeps = {
  hasServerSupabaseEnv,
  getServerAuthUser,
  hasServiceRoleEnv,
  createServiceRoleClient,
  loadRequest: async ({ client, requestId }) => {
    const response = await client
      .from("property_requests")
      .select(PROPERTY_REQUEST_SELECT_COLUMNS)
      .eq("id", requestId)
      .maybeSingle();
    return response as unknown as AdminRequestRecordResult;
  },
  updateRequest: async ({ client, requestId, updates }) => {
    const response = await client
      .from("property_requests")
      .update(updates)
      .eq("id", requestId)
      .select(PROPERTY_REQUEST_SELECT_COLUMNS)
      .maybeSingle();
    return response as unknown as AdminRequestRecordResult;
  },
  now: () => new Date().toISOString(),
};

export async function patchAdminPropertyRequestResponse(
  req: NextRequest,
  requestId: string,
  deps: AdminPropertyRequestRouteDeps = defaultDeps
) {
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.getServerAuthUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = adminRequestActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const client = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : auth.supabase;
  const { data: existingRow, error: loadError } = await deps.loadRequest({
    client: client as AdminAuthResult["supabase"],
    requestId,
  });

  if (loadError) {
    return NextResponse.json({ error: "Unable to load request" }, { status: 500 });
  }
  if (!existingRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const existing = mapPropertyRequestRecord(existingRow);
  const now = deps.now();

  if (existing.status === "removed" && parsed.data.action !== "remove") {
    return NextResponse.json({ error: "Removed requests cannot be changed further." }, { status: 409 });
  }

  const nextStatus =
    parsed.data.action === "close"
      ? "closed"
      : parsed.data.action === "expire"
        ? "expired"
        : "removed";

  const updates: Record<string, unknown> = { status: nextStatus };
  if (parsed.data.action === "expire" || parsed.data.action === "remove") {
    updates.expires_at = now;
  }

  const { data: updatedRow, error: updateError } = await deps.updateRequest({
    client: client as AdminAuthResult["supabase"],
    requestId,
    updates,
  });

  if (updateError || !updatedRow) {
    return NextResponse.json({ error: "Unable to update request" }, { status: 500 });
  }

  logOperationalEvent({
    request: req,
    route: "/api/admin/requests/[id]",
    event: "property_request_moderation_action",
    details: {
      requestRecordId: requestId,
      action: parsed.data.action,
      actorId: auth.user.id,
      at: now,
    },
  });

  return NextResponse.json({
    ok: true,
    item: mapPropertyRequestRecord(updatedRow),
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return patchAdminPropertyRequestResponse(req, id);
}
