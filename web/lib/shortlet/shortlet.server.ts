import type { SupabaseClient } from "@supabase/supabase-js";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type ShortletBookingMode = "instant" | "request";

export type ShortletSettingsRow = {
  property_id: string;
  booking_mode: ShortletBookingMode;
  nightly_price_minor: number | null;
  cleaning_fee_minor: number;
  deposit_minor: number;
  min_nights: number;
  max_nights: number | null;
  advance_notice_hours: number;
  prep_days: number;
  checkin_time: string | null;
  checkout_time: string | null;
};

export type ShortletBookingRow = {
  id: string;
  property_id: string;
  guest_user_id: string;
  host_user_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  status: "pending" | "confirmed" | "declined" | "cancelled" | "expired" | "completed";
  total_amount_minor: number;
  currency: string;
  pricing_snapshot_json: Record<string, unknown>;
  payment_reference: string | null;
  expires_at: string | null;
  refund_required: boolean;
  created_at: string;
  updated_at: string;
};

export type HostShortletBookingSummary = {
  id: string;
  property_id: string;
  property_title: string | null;
  city: string | null;
  guest_user_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  status: ShortletBookingRow["status"];
  total_amount_minor: number;
  currency: string;
  expires_at: string | null;
  created_at: string;
};

export type AdminShortletBookingSummary = {
  id: string;
  property_id: string;
  property_title: string | null;
  city: string | null;
  guest_user_id: string;
  host_user_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  status: ShortletBookingRow["status"];
  total_amount_minor: number;
  currency: string;
  expires_at: string | null;
  created_at: string;
  refund_required: boolean;
};

export type AdminShortletPayoutSummary = {
  id: string;
  booking_id: string;
  host_user_id: string;
  amount_minor: number;
  currency: string;
  status: "eligible" | "paid";
  paid_at: string | null;
  paid_ref: string | null;
  note: string | null;
  created_at: string;
  booking_check_in: string | null;
  booking_status: string | null;
  property_id: string | null;
  property_title: string | null;
  property_city: string | null;
};

export type ShortletBlockRow = {
  id: string;
  property_id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
};

export function mapLegacyListingIntent(intent: string | null | undefined) {
  const normalized = String(intent || "").trim().toLowerCase();
  if (normalized === "rent" || normalized === "rent_lease") return "rent_lease" as const;
  if (normalized === "buy" || normalized === "sale") return "sale" as const;
  if (normalized === "shortlet") return "shortlet" as const;
  if (normalized === "off_plan") return "off_plan" as const;
  return null;
}

export async function getShortletSettingsForProperty(
  client: SupabaseClient,
  propertyId: string
): Promise<ShortletSettingsRow | null> {
  const { data, error } = await client
    .from("shortlet_settings")
    .select(
      "property_id,booking_mode,nightly_price_minor,cleaning_fee_minor,deposit_minor,min_nights,max_nights,advance_notice_hours,prep_days,checkin_time,checkout_time"
    )
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) return null;
  return (data as ShortletSettingsRow | null) ?? null;
}

export async function listHostShortletBookings(input: {
  client: SupabaseClient;
  hostUserId: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(100, Math.trunc(input.limit ?? 100)));
  const { data, error } = await input.client
    .from("shortlet_bookings")
    .select(
      "id,property_id,guest_user_id,check_in,check_out,nights,status,total_amount_minor,currency,expires_at,created_at,properties!inner(title,city)"
    )
    .eq("host_user_id", input.hostUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Unable to load host shortlet bookings");
  }

  return (((data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const property = (row.properties ?? null) as { title?: string | null; city?: string | null } | null;
    return {
      id: String(row.id || ""),
      property_id: String(row.property_id || ""),
      property_title: property?.title ?? null,
      city: property?.city ?? null,
      guest_user_id: String(row.guest_user_id || ""),
      check_in: String(row.check_in || ""),
      check_out: String(row.check_out || ""),
      nights: Number(row.nights || 0),
      status: String(row.status || "pending") as ShortletBookingRow["status"],
      total_amount_minor: Number(row.total_amount_minor || 0),
      currency: String(row.currency || "NGN"),
      expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
      created_at: String(row.created_at || ""),
    } satisfies HostShortletBookingSummary;
  })) as HostShortletBookingSummary[];
}

export async function listAdminShortletBookings(input: {
  client: SupabaseClient;
  status?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(500, Math.trunc(input.limit ?? 200)));
  let query = input.client
    .from("shortlet_bookings")
    .select(
      "id,property_id,guest_user_id,host_user_id,check_in,check_out,nights,status,total_amount_minor,currency,expires_at,created_at,refund_required,properties!inner(title,city)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }
  if (input.from) {
    query = query.gte("created_at", `${input.from}T00:00:00.000Z`);
  }
  if (input.to) {
    query = query.lte("created_at", `${input.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Unable to load shortlet bookings");
  }

  let rows = (((data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const property = (row.properties ?? null) as { title?: string | null; city?: string | null } | null;
    return {
      id: String(row.id || ""),
      property_id: String(row.property_id || ""),
      property_title: property?.title ?? null,
      city: property?.city ?? null,
      guest_user_id: String(row.guest_user_id || ""),
      host_user_id: String(row.host_user_id || ""),
      check_in: String(row.check_in || ""),
      check_out: String(row.check_out || ""),
      nights: Number(row.nights || 0),
      status: String(row.status || "pending") as ShortletBookingRow["status"],
      total_amount_minor: Number(row.total_amount_minor || 0),
      currency: String(row.currency || "NGN"),
      expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
      created_at: String(row.created_at || ""),
      refund_required: !!row.refund_required,
    } satisfies AdminShortletBookingSummary;
  })) as AdminShortletBookingSummary[];

  const queryText = (input.q || "").trim().toLowerCase();
  if (queryText) {
    rows = rows.filter((row) => {
      return (
        row.id.toLowerCase().includes(queryText) ||
        row.property_id.toLowerCase().includes(queryText) ||
        row.guest_user_id.toLowerCase().includes(queryText) ||
        row.host_user_id.toLowerCase().includes(queryText) ||
        (row.property_title || "").toLowerCase().includes(queryText)
      );
    });
  }
  return rows;
}

export async function listAdminShortletPayouts(input: {
  client: SupabaseClient;
  status?: "eligible" | "paid" | "all";
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(500, Math.trunc(input.limit ?? 200)));
  let query = input.client
    .from("shortlet_payouts")
    .select(
      "id,booking_id,host_user_id,amount_minor,currency,status,paid_at,paid_ref,note,created_at,shortlet_bookings!inner(check_in,status,property_id,properties!inner(title,city))"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Unable to load shortlet payouts");
  }

  let rows = (((data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const booking = (row.shortlet_bookings ?? null) as
      | {
          check_in?: string;
          status?: string;
          property_id?: string;
          properties?: { title?: string | null; city?: string | null } | null;
        }
      | null;
    return {
      id: String(row.id || ""),
      booking_id: String(row.booking_id || ""),
      host_user_id: String(row.host_user_id || ""),
      amount_minor: Number(row.amount_minor || 0),
      currency: String(row.currency || "NGN"),
      status: (row.status === "paid" ? "paid" : "eligible") as "eligible" | "paid",
      paid_at: typeof row.paid_at === "string" ? row.paid_at : null,
      paid_ref: typeof row.paid_ref === "string" ? row.paid_ref : null,
      note: typeof row.note === "string" ? row.note : null,
      created_at: String(row.created_at || ""),
      booking_check_in: typeof booking?.check_in === "string" ? booking.check_in : null,
      booking_status: typeof booking?.status === "string" ? booking.status : null,
      property_id: typeof booking?.property_id === "string" ? booking.property_id : null,
      property_title: booking?.properties?.title ?? null,
      property_city: booking?.properties?.city ?? null,
    } satisfies AdminShortletPayoutSummary;
  })) as AdminShortletPayoutSummary[];

  if (input.status === "eligible" || !input.status || input.status === "all") {
    const now = Date.now();
    rows = rows.filter((row) => {
      if (row.status !== "eligible") return true;
      const checkInMs = Date.parse(row.booking_check_in || "");
      const bookingStatus = (row.booking_status || "").toLowerCase();
      return bookingStatus === "completed" || (Number.isFinite(checkInMs) && checkInMs <= now);
    });
  }

  return rows;
}

export async function listBlockedRangesForProperty(input: {
  client: SupabaseClient;
  propertyId: string;
  from?: string | null;
  to?: string | null;
}) {
  let bookingQuery = input.client
    .from("shortlet_bookings")
    .select("id,property_id,check_in,check_out,status")
    .eq("property_id", input.propertyId)
    .in("status", ["pending", "confirmed", "completed"])
    .order("check_in", { ascending: true });

  let blocksQuery = input.client
    .from("shortlet_blocks")
    .select("id,property_id,date_from,date_to,reason")
    .eq("property_id", input.propertyId)
    .order("date_from", { ascending: true });

  if (input.from) {
    bookingQuery = bookingQuery.gte("check_out", input.from);
    blocksQuery = blocksQuery.gte("date_to", input.from);
  }
  if (input.to) {
    bookingQuery = bookingQuery.lte("check_in", input.to);
    blocksQuery = blocksQuery.lte("date_from", input.to);
  }

  const [{ data: bookings }, { data: blocks }] = await Promise.all([bookingQuery, blocksQuery]);

  return {
    bookings: ((bookings as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      kind: "booking" as const,
      id: String(row.id || ""),
      from: String(row.check_in || ""),
      to: String(row.check_out || ""),
      status: String(row.status || "pending"),
    })),
    blocks: ((blocks as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      kind: "block" as const,
      id: String(row.id || ""),
      from: String(row.date_from || ""),
      to: String(row.date_to || ""),
      reason: typeof row.reason === "string" ? row.reason : null,
    })),
  };
}

export type CreateShortletBookingResult = {
  bookingId: string;
  status: ShortletBookingRow["status"];
  nights: number;
  totalAmountMinor: number;
  currency: string;
  expiresAt: string | null;
  pricingSnapshot: Record<string, unknown>;
};

export async function createShortletBookingViaRpc(input: {
  client: SupabaseClient;
  propertyId: string;
  guestUserId: string;
  checkIn: string;
  checkOut: string;
}): Promise<CreateShortletBookingResult> {
  const rpcClient = input.client as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message?: string } | null }>;
  };

  const { data, error } = await rpcClient.rpc("create_shortlet_booking", {
    p_property_id: input.propertyId,
    p_guest_user_id: input.guestUserId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
  });

  if (error) {
    throw new Error(error.message || "Unable to create booking");
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("Unable to create booking");
  }

  return {
    bookingId: String(row.booking_id || ""),
    status: String(row.booking_status || "pending") as CreateShortletBookingResult["status"],
    nights: Number(row.nights || 0),
    totalAmountMinor: Number(row.total_amount_minor || 0),
    currency: String(row.currency || "NGN"),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    pricingSnapshot:
      row.pricing_snapshot_json && typeof row.pricing_snapshot_json === "object"
        ? (row.pricing_snapshot_json as Record<string, unknown>)
        : {},
  };
}

export async function respondShortletBookingViaRpc(input: {
  client: SupabaseClient;
  bookingId: string;
  hostUserId: string;
  action: "accept" | "decline";
}) {
  const rpcClient = input.client as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message?: string } | null }>;
  };

  const { data, error } = await rpcClient.rpc("respond_shortlet_booking", {
    p_booking_id: input.bookingId,
    p_host_user_id: input.hostUserId,
    p_action: input.action,
  });
  if (error) {
    throw new Error(error.message || "Unable to update booking");
  }
  const row = data?.[0] ?? null;
  return {
    bookingId: String(row?.booking_id || ""),
    status: String(row?.booking_status || "pending"),
    propertyId: String(row?.property_id || ""),
    hostUserId: String(row?.host_user_id || ""),
    guestUserId: String(row?.guest_user_id || ""),
  };
}

export async function expireDueShortletBookings(client: SupabaseClient) {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("shortlet_bookings")
    .update({ status: "expired", refund_required: true, updated_at: nowIso })
    .eq("status", "pending")
    .lt("expires_at", nowIso)
    .select("id,guest_user_id,property_id,total_amount_minor,currency");

  if (error) {
    throw new Error(error.message || "Unable to expire due bookings");
  }

  return (data as Array<Record<string, unknown>> | null) ?? [];
}

export async function ensureShortletPayoutForBooking(input: {
  client: SupabaseClient;
  bookingId: string;
  hostUserId: string;
  amountMinor: number;
  currency: string;
}) {
  const adminClient = input.client as unknown as UntypedAdminClient;
  const { error } = await adminClient
    .from("shortlet_payouts")
    .upsert(
      {
        booking_id: input.bookingId,
        host_user_id: input.hostUserId,
        amount_minor: Math.max(0, Math.trunc(input.amountMinor)),
        currency: input.currency,
        status: "eligible",
      },
      { onConflict: "booking_id" }
    );

  if (error) {
    throw new Error(error.message || "Unable to upsert shortlet payout");
  }
}

export async function markShortletPayoutPaid(input: {
  client: SupabaseClient;
  payoutId: string;
  paidRef: string | null;
  note: string | null;
}) {
  const { data, error } = await input.client
    .from("shortlet_payouts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_ref: input.paidRef,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.payoutId)
    .eq("status", "eligible")
    .select("id,status,paid_at,paid_ref")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to mark payout paid");
  }
  return (data as Record<string, unknown> | null) ?? null;
}
