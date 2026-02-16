import type { SupabaseClient } from "@supabase/supabase-js";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { canCancelBooking } from "@/lib/shortlet/bookings";
import { isBookingEligibleForPayout, resolveMarkPaidTransition } from "@/lib/shortlet/payouts";

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
  status:
    | "pending_payment"
    | "pending"
    | "confirmed"
    | "declined"
    | "cancelled"
    | "expired"
    | "completed";
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
  guest_name: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  status: ShortletBookingRow["status"];
  total_amount_minor: number;
  currency: string;
  expires_at: string | null;
  created_at: string;
};

export type HostShortletSettingSummary = {
  property_id: string;
  property_title: string | null;
  property_city: string | null;
  booking_mode: ShortletBookingMode;
  nightly_price_minor: number | null;
  cleaning_fee_minor: number;
  deposit_minor: number;
  min_nights: number;
  max_nights: number | null;
  advance_notice_hours: number;
  prep_days: number;
};

export type GuestShortletBookingSummary = {
  id: string;
  property_id: string;
  property_title: string | null;
  city: string | null;
  host_user_id: string;
  host_name: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  status: ShortletBookingRow["status"];
  total_amount_minor: number;
  currency: string;
  expires_at: string | null;
  created_at: string;
};

export type GuestShortletBookingDetail = GuestShortletBookingSummary & {
  pricing_snapshot_json: Record<string, unknown>;
  payment_reference: string | null;
  updated_at: string;
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
  paid_method: string | null;
  paid_reference: string | null;
  paid_by: string | null;
  note: string | null;
  created_at: string;
  booking_check_in: string | null;
  booking_check_out: string | null;
  booking_status: string | null;
  property_id: string | null;
  property_title: string | null;
  property_city: string | null;
};

export type HostShortletEarningSummary = {
  payout_id: string;
  booking_id: string;
  property_id: string | null;
  property_title: string | null;
  property_city: string | null;
  check_in: string | null;
  check_out: string | null;
  booking_status: string | null;
  amount_minor: number;
  currency: string;
  payout_status: "eligible" | "paid";
  paid_at: string | null;
  paid_method: string | null;
  paid_reference: string | null;
  note: string | null;
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
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Unable to load host shortlet bookings");
  }

  const rows = (((data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const property = (row.properties ?? null) as { title?: string | null; city?: string | null } | null;
    return {
      id: String(row.id || ""),
      property_id: String(row.property_id || ""),
      property_title: property?.title ?? null,
      city: property?.city ?? null,
      guest_user_id: String(row.guest_user_id || ""),
      guest_name: null,
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

  const guestIds = Array.from(new Set(rows.map((row) => row.guest_user_id).filter(Boolean)));
  if (!guestIds.length) return rows;

  const { data: profileRows } = await input.client
    .from("profiles")
    .select("id,display_name,full_name")
    .in("id", guestIds);

  const guestNameMap = new Map<string, string>();
  for (const profile of ((profileRows as Array<Record<string, unknown>> | null) ?? [])) {
    const id = String(profile.id || "");
    if (!id) continue;
    const name =
      (typeof profile.display_name === "string" && profile.display_name.trim()) ||
      (typeof profile.full_name === "string" && profile.full_name.trim()) ||
      "";
    if (name) guestNameMap.set(id, name);
  }

  return rows.map((row) => ({
    ...row,
    guest_name: guestNameMap.get(row.guest_user_id) ?? null,
  }));
}

export async function listHostShortletSettings(input: {
  client: SupabaseClient;
  hostUserId: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(200, Math.trunc(input.limit ?? 120)));
  const { data: propertyRows, error: propertyError } = await input.client
    .from("properties")
    .select("id,title,city")
    .eq("owner_id", input.hostUserId)
    .eq("listing_intent", "shortlet")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (propertyError) {
    throw new Error(propertyError.message || "Unable to load host shortlet listings");
  }

  const properties = ((propertyRows as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    property_id: String(row.id || ""),
    property_title: typeof row.title === "string" ? row.title : null,
    property_city: typeof row.city === "string" ? row.city : null,
  }));
  if (!properties.length) return [] as HostShortletSettingSummary[];

  const propertyIds = properties.map((row) => row.property_id).filter(Boolean);
  const { data: settingsRows, error: settingsError } = await input.client
    .from("shortlet_settings")
    .select(
      "property_id,booking_mode,nightly_price_minor,cleaning_fee_minor,deposit_minor,min_nights,max_nights,advance_notice_hours,prep_days"
    )
    .in("property_id", propertyIds);

  if (settingsError) {
    throw new Error(settingsError.message || "Unable to load shortlet settings");
  }

  const settingsMap = new Map<string, Record<string, unknown>>();
  for (const row of ((settingsRows as Array<Record<string, unknown>> | null) ?? [])) {
    const propertyId = String(row.property_id || "");
    if (propertyId) settingsMap.set(propertyId, row);
  }

  return properties.map((property) => {
    const settings = settingsMap.get(property.property_id);
    return {
      property_id: property.property_id,
      property_title: property.property_title,
      property_city: property.property_city,
      booking_mode:
        settings?.booking_mode === "instant" ? "instant" : "request",
      nightly_price_minor:
        typeof settings?.nightly_price_minor === "number"
          ? Number(settings.nightly_price_minor)
          : null,
      cleaning_fee_minor:
        typeof settings?.cleaning_fee_minor === "number"
          ? Number(settings.cleaning_fee_minor)
          : 0,
      deposit_minor:
        typeof settings?.deposit_minor === "number"
          ? Number(settings.deposit_minor)
          : 0,
      min_nights:
        typeof settings?.min_nights === "number"
          ? Number(settings.min_nights)
          : 1,
      max_nights:
        typeof settings?.max_nights === "number"
          ? Number(settings.max_nights)
          : null,
      advance_notice_hours:
        typeof settings?.advance_notice_hours === "number"
          ? Number(settings.advance_notice_hours)
          : 0,
      prep_days:
        typeof settings?.prep_days === "number"
          ? Number(settings.prep_days)
          : 0,
    } satisfies HostShortletSettingSummary;
  });
}

export async function listHostShortletEarnings(input: {
  client: SupabaseClient;
  hostUserId: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(120, Math.trunc(input.limit ?? 60)));
  const { data, error } = await input.client
    .from("shortlet_payouts")
    .select(
      "id,booking_id,amount_minor,currency,status,paid_at,paid_method,paid_reference,note,shortlet_bookings!inner(property_id,check_in,check_out,status,properties!inner(title,city))"
    )
    .eq("host_user_id", input.hostUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Unable to load shortlet earnings");
  }

  return (((data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const booking = (row.shortlet_bookings ?? null) as
      | {
          property_id?: string;
          check_in?: string;
          check_out?: string;
          status?: string;
          properties?: { title?: string | null; city?: string | null } | null;
        }
      | null;
    return {
      payout_id: String(row.id || ""),
      booking_id: String(row.booking_id || ""),
      property_id: typeof booking?.property_id === "string" ? booking.property_id : null,
      property_title: booking?.properties?.title ?? null,
      property_city: booking?.properties?.city ?? null,
      check_in: typeof booking?.check_in === "string" ? booking.check_in : null,
      check_out: typeof booking?.check_out === "string" ? booking.check_out : null,
      booking_status: typeof booking?.status === "string" ? booking.status : null,
      amount_minor: Number(row.amount_minor || 0),
      currency: String(row.currency || "NGN"),
      payout_status: (row.status === "paid" ? "paid" : "eligible") as "eligible" | "paid",
      paid_at: typeof row.paid_at === "string" ? row.paid_at : null,
      paid_method: typeof row.paid_method === "string" ? row.paid_method : null,
      paid_reference: typeof row.paid_reference === "string" ? row.paid_reference : null,
      note: typeof row.note === "string" ? row.note : null,
    } satisfies HostShortletEarningSummary;
  })) as HostShortletEarningSummary[];
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

export async function listGuestShortletBookings(input: {
  client: SupabaseClient;
  guestUserId: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(120, Math.trunc(input.limit ?? 80)));
  const { data, error } = await input.client
    .from("shortlet_bookings")
    .select(
      "id,property_id,host_user_id,check_in,check_out,nights,status,total_amount_minor,currency,expires_at,created_at,properties!inner(title,city)"
    )
    .eq("guest_user_id", input.guestUserId)
    .order("check_in", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Unable to load guest shortlet bookings");
  }

  const rows = (((data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const property = (row.properties ?? null) as
      | { title?: string | null; city?: string | null }
      | null;
    return {
      id: String(row.id || ""),
      property_id: String(row.property_id || ""),
      property_title: property?.title ?? null,
      city: property?.city ?? null,
      host_user_id: String(row.host_user_id || ""),
      host_name: null,
      check_in: String(row.check_in || ""),
      check_out: String(row.check_out || ""),
      nights: Number(row.nights || 0),
      status: String(row.status || "pending") as ShortletBookingRow["status"],
      total_amount_minor: Number(row.total_amount_minor || 0),
      currency: String(row.currency || "NGN"),
      expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
      created_at: String(row.created_at || ""),
    } satisfies GuestShortletBookingSummary;
  })) as GuestShortletBookingSummary[];

  const hostIds = Array.from(new Set(rows.map((row) => row.host_user_id).filter(Boolean)));
  if (!hostIds.length) return rows;
  const { data: profileRows } = await input.client
    .from("profiles")
    .select("id,display_name,full_name,business_name")
    .in("id", hostIds);
  const hostNameMap = new Map<string, string>();
  for (const profile of ((profileRows as Array<Record<string, unknown>> | null) ?? [])) {
    const id = String(profile.id || "");
    if (!id) continue;
    const name =
      (typeof profile.business_name === "string" && profile.business_name.trim()) ||
      (typeof profile.display_name === "string" && profile.display_name.trim()) ||
      (typeof profile.full_name === "string" && profile.full_name.trim()) ||
      "";
    if (name) hostNameMap.set(id, name);
  }

  return rows.map((row) => ({
    ...row,
    host_name: hostNameMap.get(row.host_user_id) ?? null,
  }));
}

export async function getGuestShortletBookingById(input: {
  client: SupabaseClient;
  guestUserId: string;
  bookingId: string;
}) {
  const { data, error } = await input.client
    .from("shortlet_bookings")
    .select(
      "id,property_id,host_user_id,check_in,check_out,nights,status,total_amount_minor,currency,expires_at,created_at,updated_at,payment_reference,pricing_snapshot_json,properties!inner(title,city)"
    )
    .eq("id", input.bookingId)
    .eq("guest_user_id", input.guestUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load booking");
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const property = (row.properties ?? null) as
    | { title?: string | null; city?: string | null }
    | null;

  const hostUserId = String(row.host_user_id || "");
  let hostName: string | null = null;
  if (hostUserId) {
    const { data: profile } = await input.client
      .from("profiles")
      .select("display_name,full_name,business_name")
      .eq("id", hostUserId)
      .maybeSingle();
    if (profile) {
      const profileRow = profile as Record<string, unknown>;
      const resolvedName =
        (typeof profileRow.business_name === "string" && profileRow.business_name.trim()) ||
        (typeof profileRow.display_name === "string" && profileRow.display_name.trim()) ||
        (typeof profileRow.full_name === "string" && profileRow.full_name.trim()) ||
        "";
      hostName = resolvedName || null;
    }
  }

  return {
    id: String(row.id || ""),
    property_id: String(row.property_id || ""),
    property_title: property?.title ?? null,
    city: property?.city ?? null,
    host_user_id: hostUserId,
    host_name: hostName,
    check_in: String(row.check_in || ""),
    check_out: String(row.check_out || ""),
    nights: Number(row.nights || 0),
    status: String(row.status || "pending") as ShortletBookingRow["status"],
    total_amount_minor: Number(row.total_amount_minor || 0),
    currency: String(row.currency || "NGN"),
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || row.created_at || ""),
    payment_reference: typeof row.payment_reference === "string" ? row.payment_reference : null,
    pricing_snapshot_json:
      row.pricing_snapshot_json && typeof row.pricing_snapshot_json === "object"
        ? (row.pricing_snapshot_json as Record<string, unknown>)
        : {},
  } satisfies GuestShortletBookingDetail;
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
      "id,booking_id,host_user_id,amount_minor,currency,status,paid_at,paid_method,paid_reference,paid_by,note,created_at,shortlet_bookings!inner(check_in,check_out,status,property_id,properties!inner(title,city))"
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
          check_out?: string;
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
      paid_method: typeof row.paid_method === "string" ? row.paid_method : null,
      paid_reference: typeof row.paid_reference === "string" ? row.paid_reference : null,
      paid_by: typeof row.paid_by === "string" ? row.paid_by : null,
      note: typeof row.note === "string" ? row.note : null,
      created_at: String(row.created_at || ""),
      booking_check_in: typeof booking?.check_in === "string" ? booking.check_in : null,
      booking_check_out: typeof booking?.check_out === "string" ? booking.check_out : null,
      booking_status: typeof booking?.status === "string" ? booking.status : null,
      property_id: typeof booking?.property_id === "string" ? booking.property_id : null,
      property_title: booking?.properties?.title ?? null,
      property_city: booking?.properties?.city ?? null,
    } satisfies AdminShortletPayoutSummary;
  })) as AdminShortletPayoutSummary[];

  if (input.status === "eligible" || !input.status || input.status === "all") {
    rows = rows.filter((row) => {
      if (row.status !== "eligible") return true;
      return isBookingEligibleForPayout({
        bookingStatus: row.booking_status,
        checkOut: row.booking_check_out,
      });
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
    .in("status", ["pending", "confirmed"])
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

export async function cancelShortletBooking(input: {
  client: SupabaseClient;
  bookingId: string;
  actorUserId: string;
  isAdmin?: boolean;
}) {
  const { data: booking, error: bookingError } = await input.client
    .from("shortlet_bookings")
    .select("id,status,guest_user_id,host_user_id")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (bookingError || !booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }
  const bookingStatus = String(booking.status || "pending") as ShortletBookingRow["status"];
  const canCancel =
    !!input.isAdmin ||
    String(booking.guest_user_id || "") === input.actorUserId ||
    String(booking.host_user_id || "") === input.actorUserId;
  if (!canCancel) {
    throw new Error("FORBIDDEN");
  }
  if (!canCancelBooking(bookingStatus)) {
    throw new Error("INVALID_STATUS");
  }

  const { data: updated, error: updateError } = await input.client
    .from("shortlet_bookings")
    .update({
      status: "cancelled",
      expires_at: null,
      refund_required: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .in("status", ["pending_payment", "pending", "confirmed"])
    .select("id,status,property_id,guest_user_id,host_user_id")
    .maybeSingle();
  if (updateError || !updated) {
    throw new Error("INVALID_STATUS");
  }

  await input.client
    .from("shortlet_payouts")
    .delete()
    .eq("booking_id", input.bookingId)
    .eq("status", "eligible");

  return {
    bookingId: String(updated.id || ""),
    status: String(updated.status || "cancelled"),
    propertyId: String(updated.property_id || ""),
    hostUserId: String(updated.host_user_id || ""),
    guestUserId: String(updated.guest_user_id || ""),
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
  const { data: existing, error: existingError } = await adminClient
    .from("shortlet_payouts")
    .select("id")
    .eq("booking_id", input.bookingId)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message || "Unable to check shortlet payout");
  }
  if (existing?.id) return;

  const { error } = await adminClient.from("shortlet_payouts").insert({
    booking_id: input.bookingId,
    host_user_id: input.hostUserId,
    amount_minor: Math.max(0, Math.trunc(input.amountMinor)),
    currency: input.currency,
    status: "eligible",
  });

  if (error) {
    throw new Error(error.message || "Unable to upsert shortlet payout");
  }
}

export async function markShortletPayoutPaid(input: {
  client: SupabaseClient;
  payoutId: string;
  paidMethod: string;
  paidReference: string;
  note: string | null;
  paidBy: string | null;
}) {
  const { data: existing, error: existingError } = await input.client
    .from("shortlet_payouts")
    .select("id,status,booking_id")
    .eq("id", input.payoutId)
    .maybeSingle();
  if (existingError || !existing) {
    throw new Error("PAYOUT_NOT_FOUND");
  }

  const transition = resolveMarkPaidTransition(String(existing.status || ""));
  if (transition === "already_paid") {
    const { data: current } = await input.client
      .from("shortlet_payouts")
      .select("id,status,paid_at,paid_method,paid_reference,paid_by,note")
      .eq("id", input.payoutId)
      .maybeSingle();
    return {
      payout: (current as Record<string, unknown> | null) ?? null,
      alreadyPaid: true,
    };
  }
  if (transition !== "mark_paid") {
    throw new Error("INVALID_PAYOUT_STATUS");
  }

  const paidAt = new Date().toISOString();
  const { data, error } = await input.client
    .from("shortlet_payouts")
    .update({
      status: "paid",
      paid_at: paidAt,
      paid_method: input.paidMethod,
      paid_reference: input.paidReference,
      paid_by: input.paidBy,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.payoutId)
    .eq("status", "eligible")
    .select("id,status,paid_at,paid_method,paid_reference,paid_by,note,booking_id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to mark payout paid");
  }

  if (!data) {
    const { data: current } = await input.client
      .from("shortlet_payouts")
      .select("id,status,paid_at,paid_method,paid_reference,paid_by,note")
      .eq("id", input.payoutId)
      .maybeSingle();
    if (String(current?.status || "") === "paid") {
      return { payout: (current as Record<string, unknown> | null) ?? null, alreadyPaid: true };
    }
    throw new Error("Unable to mark payout paid");
  }

  await input.client.from("shortlet_payout_audit").insert({
    payout_id: input.payoutId,
    booking_id: String((data as Record<string, unknown>).booking_id || existing.booking_id || ""),
    action: "mark_paid",
    actor_user_id: input.paidBy,
    meta: {
      method: input.paidMethod,
      reference: input.paidReference,
      note: input.note,
      paid_at: paidAt,
    },
  });

  return {
    payout: (data as Record<string, unknown> | null) ?? null,
    alreadyPaid: false,
  };
}
