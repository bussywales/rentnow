import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { markShortletPayoutPaid } from "@/lib/shortlet/shortlet.server";
import { isBookingEligibleForPayout, resolveMarkPaidTransition } from "@/lib/shortlet/payouts";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/shortlets/payouts/[id]/pay";

const payloadSchema = z.object({
  paid_method: z.string().trim().min(2).max(80),
  paid_reference: z.string().trim().min(2).max(120),
  note: z.string().trim().min(2).max(500),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Payout id required" }, { status: 422 });

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const db = hasServiceRoleEnv()
    ? (createServiceRoleClient() as unknown as UntypedAdminClient)
    : ((await createServerSupabaseClient()) as unknown as UntypedAdminClient);

  const { data: payoutData, error: payoutError } = await db
    .from("shortlet_payouts")
    .select("id,status,booking_id,shortlet_bookings!inner(status,check_out)")
    .eq("id", id)
    .maybeSingle();

  if (payoutError || !payoutData) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const payout = payoutData as {
    id: string;
    status: string;
    booking_id: string;
    shortlet_bookings?: { status?: string; check_out?: string } | null;
  };

  const transition = resolveMarkPaidTransition(payout.status);
  if (transition === "blocked") {
    return NextResponse.json({ error: "Payout is not eligible for this action." }, { status: 409 });
  }
  if (transition === "already_paid") {
    return NextResponse.json({
      ok: true,
      already_paid: true,
      payout: { id: payout.id, status: "paid" },
    });
  }

  const canPay = isBookingEligibleForPayout({
    bookingStatus: String(payout.shortlet_bookings?.status || ""),
    checkOut: String(payout.shortlet_bookings?.check_out || ""),
  });
  if (!canPay) {
    return NextResponse.json(
      { error: "Payout is only allowed after stay end date or completed booking." },
      { status: 409 }
    );
  }

  try {
    const updated = await markShortletPayoutPaid({
      client: db as unknown as SupabaseClient,
      payoutId: id,
      paidMethod: parsed.data.paid_method,
      paidReference: parsed.data.paid_reference,
      note: parsed.data.note,
      paidBy: auth.user.id,
    });

    return NextResponse.json({
      ok: true,
      already_paid: updated.alreadyPaid,
      payout: updated.payout,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mark payout paid" },
      { status: 500 }
    );
  }
}
