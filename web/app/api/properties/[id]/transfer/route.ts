import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import { createListingTransferRequest } from "@/lib/properties/listing-ownership-transfer.server";
import { logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/properties/[id]/transfer";

const bodySchema = z.object({
  recipientEmail: z.string().email(),
});

type CreateDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  createListingTransferRequest: typeof createListingTransferRequest;
  logFailure: typeof logFailure;
};

const defaultDeps: CreateDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getUserRole,
  createListingTransferRequest,
  logFailure,
};

export async function postPropertyTransferCreateResponse(
  request: NextRequest,
  propertyId: string,
  deps: CreateDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  if (role !== "landlord" && role !== "agent") {
    return NextResponse.json(
      { error: "Only landlord and agent owners can transfer listings." },
      { status: 403 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 });
  }

  const result = await deps.createListingTransferRequest({
    propertyId,
    initiatorUserId: auth.user.id,
    recipientEmail: parsed.data.recipientEmail,
  });

  if (!result.ok) {
    const status =
      result.code === "FORBIDDEN"
        ? 403
        : result.code === "LISTING_NOT_FOUND"
          ? 404
          : result.code === "PENDING_EXISTS" || result.code === "SELF_TRANSFER" || result.code === "RECIPIENT_ROLE_INVALID"
            ? 409
            : result.code === "INVALID_RECIPIENT"
              ? 404
              : 400;

    if (status >= 500) {
      deps.logFailure({ request, route: routeLabel, startTime, status, error: result.error });
    }

    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ ok: true, request: result.request });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postPropertyTransferCreateResponse(request, id);
}
