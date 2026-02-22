import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { requireRole } from "@/lib/authz";
import { isBookingEligibleForPayout } from "@/lib/shortlet/payouts";
import { getLatestShortletPaymentStatusForBooking } from "@/lib/shortlet/shortlet.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/host/shortlets/payouts/request";

const payloadSchema = z.object({
  bookingId: z.string().trim().min(8).max(80),
  payoutMethod: z.string().trim().min(2).max(80).optional(),
  note: z.string().trim().max(500).optional(),
});

type HostPayoutRow = {
  payoutId: string;
  bookingId: string;
  hostUserId: string;
  payoutStatus: string;
  bookingStatus: string;
  checkOut: string | null;
};

type ExistingRequestRow = {
  id: string;
  actor_user_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
};

async function defaultLoadPayoutByBooking(
  client: SupabaseClient,
  bookingId: string
): Promise<HostPayoutRow | null> {
  const { data, error } = await client
    .from("shortlet_payouts")
    .select("id,booking_id,host_user_id,status,shortlet_bookings!inner(status,check_out)")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load payout");
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const bookingRelation = row.shortlet_bookings as
    | { status?: string | null; check_out?: string | null }
    | Array<{ status?: string | null; check_out?: string | null }>
    | null
    | undefined;
  const booking = Array.isArray(bookingRelation)
    ? (bookingRelation[0] ?? null)
    : bookingRelation ?? null;

  return {
    payoutId: String(row.id || ""),
    bookingId: String(row.booking_id || ""),
    hostUserId: String(row.host_user_id || ""),
    payoutStatus: String(row.status || ""),
    bookingStatus: String(booking?.status || ""),
    checkOut: typeof booking?.check_out === "string" ? booking.check_out : null,
  };
}

async function defaultLoadExistingRequest(
  client: SupabaseClient,
  payoutId: string
): Promise<ExistingRequestRow | null> {
  const { data, error } = await client
    .from("shortlet_payout_audit")
    .select("id,actor_user_id,created_at,meta")
    .eq("payout_id", payoutId)
    .eq("action", "request_payout")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message || "Unable to load payout request");
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id || ""),
    actor_user_id: typeof row.actor_user_id === "string" ? row.actor_user_id : null,
    created_at: String(row.created_at || ""),
    meta:
      row.meta && typeof row.meta === "object"
        ? (row.meta as Record<string, unknown>)
        : {},
  };
}

async function defaultInsertRequestAudit(input: {
  client: SupabaseClient;
  payoutId: string;
  bookingId: string;
  actorUserId: string;
  payoutMethod: string;
  note: string | null;
}) {
  const { error } = await input.client.from("shortlet_payout_audit").insert({
    payout_id: input.payoutId,
    booking_id: input.bookingId,
    action: "request_payout",
    actor_user_id: input.actorUserId,
    meta: {
      payout_method: input.payoutMethod,
      note: input.note,
      source: "host_earnings",
    },
  });
  if (error) throw new Error(error.message || "Unable to create payout request");
}

export type HostPayoutRequestRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  readActingAsFromRequest: typeof readActingAsFromRequest;
  hasActiveDelegation: typeof hasActiveDelegation;
  loadPayoutByBooking: typeof defaultLoadPayoutByBooking;
  getLatestShortletPaymentStatusForBooking: typeof getLatestShortletPaymentStatusForBooking;
  isBookingEligibleForPayout: typeof isBookingEligibleForPayout;
  loadExistingRequest: typeof defaultLoadExistingRequest;
  insertRequestAudit: typeof defaultInsertRequestAudit;
};

const defaultDeps: HostPayoutRequestRouteDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
  readActingAsFromRequest,
  hasActiveDelegation,
  loadPayoutByBooking: defaultLoadPayoutByBooking,
  getLatestShortletPaymentStatusForBooking,
  isBookingEligibleForPayout,
  loadExistingRequest: defaultLoadExistingRequest,
  insertRequestAudit: defaultInsertRequestAudit,
};

export async function postHostShortletPayoutRequestResponse(
  request: NextRequest,
  deps: HostPayoutRequestRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payout request payload" }, { status: 422 });
  }

  const bookingId = parsed.data.bookingId;
  const payoutMethod = parsed.data.payoutMethod?.trim() || "bank_transfer";
  const note = parsed.data.note?.trim() || null;

  const adminClient = deps.createServiceRoleClient() as unknown as SupabaseClient;
  const payout = await deps.loadPayoutByBooking(adminClient, bookingId).catch(() => null);
  if (!payout) {
    return NextResponse.json({ error: "Payout record not found for this booking." }, { status: 404 });
  }

  const actingAs = deps.readActingAsFromRequest(request);
  let canAccess = auth.role === "admin" || auth.user.id === payout.hostUserId;
  if (!canAccess && auth.role === "agent") {
    canAccess = await deps.hasActiveDelegation(auth.supabase, auth.user.id, payout.hostUserId);
    if (canAccess && actingAs && actingAs !== payout.hostUserId) {
      canAccess = false;
    }
  }
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (String(payout.payoutStatus).toLowerCase() === "paid") {
    return NextResponse.json({ error: "This payout has already been paid." }, { status: 409 });
  }

  const paymentStatus = await deps
    .getLatestShortletPaymentStatusForBooking({
      client: adminClient,
      bookingId: payout.bookingId,
    })
    .catch(() => null);

  if (String(paymentStatus || "").toLowerCase() !== "succeeded") {
    return NextResponse.json({ error: "Payment is not confirmed for this booking." }, { status: 409 });
  }

  const bookingEligible = deps.isBookingEligibleForPayout({
    bookingStatus: payout.bookingStatus,
    checkOut: payout.checkOut,
  });
  if (!bookingEligible) {
    return NextResponse.json({ error: "Payout can only be requested after stay completion." }, { status: 409 });
  }

  const existingRequest = await deps.loadExistingRequest(adminClient, payout.payoutId).catch(() => null);
  if (existingRequest) {
    return NextResponse.json({
      ok: true,
      alreadyRequested: true,
      request: {
        payoutId: payout.payoutId,
        bookingId: payout.bookingId,
        requestedAt: existingRequest.created_at,
        payoutMethod:
          typeof existingRequest.meta.payout_method === "string"
            ? String(existingRequest.meta.payout_method)
            : "bank_transfer",
      },
    });
  }

  try {
    await deps.insertRequestAudit({
      client: adminClient,
      payoutId: payout.payoutId,
      bookingId: payout.bookingId,
      actorUserId: auth.user.id,
      payoutMethod,
      note,
    });
    return NextResponse.json({
      ok: true,
      alreadyRequested: false,
      request: {
        payoutId: payout.payoutId,
        bookingId: payout.bookingId,
        requestedAt: new Date().toISOString(),
        payoutMethod,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to request payout" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return postHostShortletPayoutRequestResponse(request, defaultDeps);
}
