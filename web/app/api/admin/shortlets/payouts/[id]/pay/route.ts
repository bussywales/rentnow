import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { markShortletPayoutPaid } from "@/lib/shortlet/shortlet.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/shortlets/payouts/[id]/pay";

const payloadSchema = z.object({
  paid_ref: z.string().max(120).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
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
    .select("id,status,booking_id,shortlet_bookings!inner(status,check_in)")
    .eq("id", id)
    .maybeSingle();

  if (payoutError || !payoutData) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const payout = payoutData as {
    id: string;
    status: string;
    booking_id: string;
    shortlet_bookings?: { status?: string; check_in?: string } | null;
  };

  if (payout.status !== "eligible") {
    return NextResponse.json({ error: "Payout already processed" }, { status: 409 });
  }

  const bookingStatus = String(payout.shortlet_bookings?.status || "");
  const checkIn = String(payout.shortlet_bookings?.check_in || "");
  const checkInMs = Date.parse(checkIn);
  const now = Date.now();
  const canPay =
    bookingStatus === "completed" ||
    (bookingStatus === "confirmed" && Number.isFinite(checkInMs) && checkInMs <= now);
  if (!canPay) {
    return NextResponse.json(
      { error: "Payout is only allowed after check-in date or completed booking." },
      { status: 409 }
    );
  }

  try {
    const updated = await markShortletPayoutPaid({
      client: db as unknown as SupabaseClient,
      payoutId: id,
      paidRef: parsed.data.paid_ref ?? null,
      note: parsed.data.note ?? null,
    });

    if (!updated) {
      return NextResponse.json({ error: "Payout already processed" }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      payout: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mark payout paid" },
      { status: 500 }
    );
  }
}
