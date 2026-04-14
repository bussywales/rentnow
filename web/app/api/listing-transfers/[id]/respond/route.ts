import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import { respondToListingTransferRequest } from "@/lib/properties/listing-ownership-transfer.server";
import { logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/listing-transfers/[id]/respond";

const bodySchema = z.object({
  action: z.enum(["accept", "reject", "cancel"]),
});

type RespondDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  respondToListingTransferRequest: typeof respondToListingTransferRequest;
  logFailure: typeof logFailure;
};

const defaultDeps: RespondDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getUserRole,
  respondToListingTransferRequest,
  logFailure,
};

export async function postListingTransferRespondResponse(
  request: NextRequest,
  transferId: string,
  deps: RespondDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  if (role !== "landlord" && role !== "agent" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transfer action." }, { status: 400 });
  }

  const result = await deps.respondToListingTransferRequest({
    requestId: transferId,
    actorUserId: auth.user.id,
    action: parsed.data.action,
  });

  if (!result.ok) {
    const status =
      result.code === "REQUEST_NOT_FOUND"
        ? 404
        : result.code === "NOT_RECIPIENT" || result.code === "NOT_INITIATOR" || result.code === "FORBIDDEN"
          ? 403
          : result.code === "PAYMENT_REQUIRED"
            ? 402
            : result.code === "BILLING_REQUIRED" || result.code === "REQUEST_NOT_PENDING" || result.code === "REQUEST_EXPIRED" || result.code === "ACTIVE_SHORTLET_BOOKINGS" || result.code === "MESSAGE_THREAD_CONFLICT" || result.code === "OWNER_CHANGED"
              ? 409
              : 400;

    if (status >= 500) {
      deps.logFailure({ request, route: routeLabel, startTime, status, error: result.error });
    }

    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        billingUrl: result.billingUrl,
        reason: result.reason,
        amount: result.amount,
        currency: result.currency,
      },
      { status }
    );
  }

  return NextResponse.json({ ok: true, request: result.request });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postListingTransferRespondResponse(request, id);
}
