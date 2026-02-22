import { toDateKey } from "@/lib/shortlet/availability";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type HostAgendaBucket = "today" | "tomorrow" | "next_7_days" | "later";

export type HostAgendaItem = {
  bookingId: string;
  propertyId: string;
  title: string;
  city?: string | null;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "pending";
  bookingMode: "request" | "instant";
  guestLabel: string;
};

type HostAgendaBookingRow = {
  id: string;
  property_id: string;
  guest_user_id: string;
  check_in: string;
  check_out: string;
  status: "pending" | "confirmed";
  property_title: string | null;
  city: string | null;
  booking_mode: "request" | "instant";
};

function parseDateOnly(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function dayDiff(fromIsoDate: string, toIsoDate: string): number | null {
  const from = parseDateOnly(fromIsoDate);
  const to = parseDateOnly(toIsoDate);
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000);
}

function resolveBucket(checkIn: string, nowDateKey: string): HostAgendaBucket {
  const diff = dayDiff(nowDateKey, checkIn);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff !== null && diff >= 2 && diff <= 7) return "next_7_days";
  return "later";
}

function normalizePaymentStatus(value: unknown): "succeeded" | "other" {
  return String(value || "").trim().toLowerCase() === "succeeded" ? "succeeded" : "other";
}

function toMaskedGuestLabel(guestUserId: string) {
  const compact = String(guestUserId || "").replace(/-/g, "");
  const last = compact.slice(-4) || "0000";
  return `Guest •••${last}`;
}

export function buildHostAgendaFromRows(input: {
  bookings: HostAgendaBookingRow[];
  latestPaymentStatusByBookingId: Map<string, "succeeded" | "other">;
  now: Date;
}) {
  const nowDateKey = toDateKey(new Date(Date.UTC(
    input.now.getUTCFullYear(),
    input.now.getUTCMonth(),
    input.now.getUTCDate()
  )));
  const output = {
    today: [] as HostAgendaItem[],
    tomorrow: [] as HostAgendaItem[],
    next7Days: [] as HostAgendaItem[],
  };

  for (const booking of input.bookings) {
    if (booking.status !== "confirmed" && booking.status !== "pending") continue;
    if (
      booking.status === "pending" &&
      input.latestPaymentStatusByBookingId.get(booking.id) !== "succeeded"
    ) {
      continue;
    }

    const item: HostAgendaItem = {
      bookingId: booking.id,
      propertyId: booking.property_id,
      title: booking.property_title || "Shortlet listing",
      city: booking.city ?? null,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      status: booking.status,
      bookingMode: booking.booking_mode,
      guestLabel: toMaskedGuestLabel(booking.guest_user_id),
    };

    const bucket = resolveBucket(booking.check_in, nowDateKey);
    if (bucket === "today") output.today.push(item);
    if (bucket === "tomorrow") output.tomorrow.push(item);
    if (bucket === "next_7_days") output.next7Days.push(item);
  }

  const sortByStart = (a: HostAgendaItem, b: HostAgendaItem) => {
    const byDate = a.checkIn.localeCompare(b.checkIn);
    if (byDate !== 0) return byDate;
    const byStatus = a.status.localeCompare(b.status);
    if (byStatus !== 0) return byStatus;
    return a.bookingId.localeCompare(b.bookingId);
  };

  output.today.sort(sortByStart);
  output.tomorrow.sort(sortByStart);
  output.next7Days.sort(sortByStart);
  return output;
}

type HostAgendaServerDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
};

const defaultDeps: HostAgendaServerDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
};

export async function getHostAgenda(
  opts: { userId: string; now: Date },
  deps: HostAgendaServerDeps = defaultDeps
): Promise<{
  today: HostAgendaItem[];
  tomorrow: HostAgendaItem[];
  next7Days: HostAgendaItem[];
}> {
  if (!opts.userId || !deps.hasServiceRoleEnv()) {
    return { today: [], tomorrow: [], next7Days: [] };
  }

  const client = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  const { data: rows, error } = await client
    .from("shortlet_bookings")
    .select(
      "id,property_id,guest_user_id,check_in,check_out,status,properties!inner(title,city,shortlet_settings(booking_mode))"
    )
    .eq("host_user_id", opts.userId)
    .in("status", ["pending", "confirmed"])
    .order("check_in", { ascending: true })
    .range(0, 499);

  if (error) {
    throw new Error(error.message || "Unable to load host agenda bookings");
  }

  const bookings = (((rows as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const relation = row.properties as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | null
        | undefined;
      const property = Array.isArray(relation) ? (relation[0] ?? null) : relation ?? null;
      const shortletSettings = (property?.shortlet_settings as
        | Array<Record<string, unknown>>
        | Record<string, unknown>
        | null
        | undefined);
      const settingsRow = Array.isArray(shortletSettings)
        ? (shortletSettings[0] ?? null)
        : shortletSettings ?? null;
      const status = String(row.status || "").trim().toLowerCase();
      if (status !== "pending" && status !== "confirmed") return null;
      return {
        id: String(row.id || ""),
        property_id: String(row.property_id || ""),
        guest_user_id: String(row.guest_user_id || ""),
        check_in: String(row.check_in || ""),
        check_out: String(row.check_out || ""),
        status,
        property_title:
          typeof property?.title === "string" ? property.title : null,
        city: typeof property?.city === "string" ? property.city : null,
        booking_mode:
          settingsRow?.booking_mode === "instant" ? "instant" : "request",
      } as HostAgendaBookingRow;
    })
    .filter((row): row is HostAgendaBookingRow => !!row && !!row.id && !!row.check_in));

  if (!bookings.length) return { today: [], tomorrow: [], next7Days: [] };

  const bookingIds = bookings.map((row) => row.id);
  const latestPaymentStatusByBookingId = new Map<string, "succeeded" | "other">();
  const paymentsSelect = async (withUpdatedAt: boolean) =>
    client
      .from("shortlet_payments")
      .select(withUpdatedAt ? "booking_id,status,updated_at,created_at" : "booking_id,status,created_at")
      .in("booking_id", bookingIds)
      .order(withUpdatedAt ? "updated_at" : "created_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, Math.max(bookingIds.length * 3, 150) - 1);

  let paymentsResult = await paymentsSelect(true);
  if (
    paymentsResult.error &&
    String(paymentsResult.error.message || "").toLowerCase().includes("updated_at")
  ) {
    paymentsResult = await paymentsSelect(false);
  }
  if (paymentsResult.error) {
    throw new Error(paymentsResult.error.message || "Unable to load payment statuses");
  }

  for (const row of ((paymentsResult.data as Array<Record<string, unknown>> | null) ?? [])) {
    const bookingId = String(row.booking_id || "");
    if (!bookingId || latestPaymentStatusByBookingId.has(bookingId)) continue;
    latestPaymentStatusByBookingId.set(bookingId, normalizePaymentStatus(row.status));
  }

  return buildHostAgendaFromRows({
    bookings,
    latestPaymentStatusByBookingId,
    now: opts.now,
  });
}
