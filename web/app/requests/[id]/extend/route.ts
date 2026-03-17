import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import {
  PROPERTY_REQUEST_SELECT_COLUMNS,
  mapPropertyRequestRecord,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";
import { resolvePropertyRequestExtension } from "@/lib/requests/property-request-retention.server";

export const dynamic = "force-dynamic";

const routeLabel = "/requests/[id]/extend";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PropertyRequestExtendRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  now: () => Date;
};

const defaultDeps: PropertyRequestExtendRouteDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getUserRole,
  now: () => new Date(),
};

function toDetailUrl(request: NextRequest, requestId: string, state: string) {
  return new URL(`/requests/${requestId}?extend=${encodeURIComponent(state)}`, request.url);
}

function toLoginUrl(request: NextRequest, requestId: string) {
  return new URL(
    `/auth/login?reason=auth&redirect=${encodeURIComponent(`/requests/${requestId}/extend`)}`,
    request.url
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return getPropertyRequestExtendResponse(request, context, defaultDeps);
}

export async function getPropertyRequestExtendResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: PropertyRequestExtendRouteDeps = defaultDeps
) {
  const { id } = await context.params;

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.redirect(toDetailUrl(request, id, "unavailable"));
  }

  const startTime = Date.now();
  const supabase = (await deps.createServerSupabaseClient()) as SupabaseClient;
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) {
    return NextResponse.redirect(toLoginUrl(request, id));
  }

  const role = await deps.getUserRole(supabase, auth.user.id);
  if (role !== "tenant") {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { data, error } = await supabase
    .from("property_requests")
    .select(PROPERTY_REQUEST_SELECT_COLUMNS)
    .eq("id", id)
    .eq("owner_user_id", auth.user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.redirect(toDetailUrl(request, id, "missing"));
  }

  const propertyRequest = mapPropertyRequestRecord(data as unknown as PropertyRequestRecord);
  const extension = resolvePropertyRequestExtension({ request: propertyRequest, now: deps.now() });
  if (!extension.ok) {
    return NextResponse.redirect(toDetailUrl(request, id, "unavailable"));
  }

  const { error: updateError } = await supabase
    .from("property_requests")
    .update({
      expires_at: extension.nextExpiresAt,
      extension_count: extension.nextExtensionCount,
    })
    .eq("id", id)
    .eq("owner_user_id", auth.user.id);

  if (updateError) {
    return NextResponse.redirect(toDetailUrl(request, id, "error"));
  }

  return NextResponse.redirect(toDetailUrl(request, id, "success"));
}
