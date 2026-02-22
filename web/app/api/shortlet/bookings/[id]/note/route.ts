import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { requireRole } from "@/lib/authz";
import { createNotification } from "@/lib/notifications/notifications.server";
import { notifyHostGuestNote } from "@/lib/shortlet/notifications.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/shortlet/bookings/[id]/note";

const notePayloadSchema = z.object({
  message: z.string().trim().min(2).max(1200),
  topic: z.enum(["check_in", "question", "arrival_time", "other"]),
});

type BookingRow = {
  id: string;
  property_id: string;
  guest_user_id: string;
  host_user_id: string;
  status: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_amount_minor: number;
  currency: string;
  property_title: string | null;
  city: string | null;
};

type BookingNoteRow = {
  id: string;
  booking_id: string;
  author_user_id: string;
  role: "tenant" | "host";
  topic: "check_in" | "question" | "arrival_time" | "other";
  message: string;
  created_at: string;
};

async function defaultLoadBooking(
  supabase: SupabaseClient,
  bookingId: string
): Promise<BookingRow | null> {
  const { data, error } = await supabase
    .from("shortlet_bookings")
    .select(
      "id,property_id,guest_user_id,host_user_id,status,check_in,check_out,nights,total_amount_minor,currency,properties(title,city)"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load booking");
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const propertyRelation = row.properties as
    | { title?: string | null; city?: string | null }
    | Array<{ title?: string | null; city?: string | null }>
    | null
    | undefined;
  const property = Array.isArray(propertyRelation)
    ? (propertyRelation[0] ?? null)
    : propertyRelation ?? null;

  return {
    id: String(row.id || ""),
    property_id: String(row.property_id || ""),
    guest_user_id: String(row.guest_user_id || ""),
    host_user_id: String(row.host_user_id || ""),
    status: String(row.status || "pending"),
    check_in: String(row.check_in || ""),
    check_out: String(row.check_out || ""),
    nights: Number(row.nights || 0),
    total_amount_minor: Number(row.total_amount_minor || 0),
    currency: String(row.currency || "NGN"),
    property_title: property?.title ?? null,
    city: property?.city ?? null,
  };
}

async function defaultListNotes(
  supabase: SupabaseClient,
  bookingId: string
): Promise<BookingNoteRow[]> {
  const { data, error } = await supabase
    .from("shortlet_booking_notes")
    .select("id,booking_id,author_user_id,role,topic,message,created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    throw new Error(error.message || "Unable to load booking notes");
  }

  return (((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id || ""),
    booking_id: String(row.booking_id || ""),
    author_user_id: String(row.author_user_id || ""),
    role: row.role === "host" ? "host" : "tenant",
    topic:
      row.topic === "check_in" ||
      row.topic === "question" ||
      row.topic === "arrival_time"
        ? row.topic
        : "other",
    message: String(row.message || ""),
    created_at: String(row.created_at || ""),
  })) as BookingNoteRow[]);
}

async function defaultInsertNote(input: {
  supabase: SupabaseClient;
  bookingId: string;
  authorUserId: string;
  role: "tenant" | "host";
  topic: "check_in" | "question" | "arrival_time" | "other";
  message: string;
}): Promise<BookingNoteRow> {
  const { data, error } = await input.supabase
    .from("shortlet_booking_notes")
    .insert({
      booking_id: input.bookingId,
      author_user_id: input.authorUserId,
      role: input.role,
      topic: input.topic,
      message: input.message,
    })
    .select("id,booking_id,author_user_id,role,topic,message,created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save booking note");
  }

  return {
    id: String(data.id || ""),
    booking_id: String(data.booking_id || ""),
    author_user_id: String(data.author_user_id || ""),
    role: data.role === "host" ? "host" : "tenant",
    topic:
      data.topic === "check_in" ||
      data.topic === "question" ||
      data.topic === "arrival_time"
        ? data.topic
        : "other",
    message: String(data.message || ""),
    created_at: String(data.created_at || ""),
  };
}

async function resolveUserEmail(userId: string): Promise<string | null> {
  if (!hasServiceRoleEnv()) return null;
  try {
    const client = createServiceRoleClient();
    const { data } = await client.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export type ShortletBookingNoteRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  hasActiveDelegation: typeof hasActiveDelegation;
  loadBooking: typeof defaultLoadBooking;
  listNotes: typeof defaultListNotes;
  insertNote: typeof defaultInsertNote;
  createNotification: typeof createNotification;
  notifyHostGuestNote: typeof notifyHostGuestNote;
  resolveUserEmail: typeof resolveUserEmail;
};

const defaultDeps: ShortletBookingNoteRouteDeps = {
  hasServerSupabaseEnv,
  requireRole,
  hasActiveDelegation,
  loadBooking: defaultLoadBooking,
  listNotes: defaultListNotes,
  insertNote: defaultInsertNote,
  createNotification,
  notifyHostGuestNote,
  resolveUserEmail,
};

async function canViewNotes(input: {
  role: "tenant" | "landlord" | "agent" | "admin";
  userId: string;
  booking: BookingRow;
  supabase: SupabaseClient;
  deps: ShortletBookingNoteRouteDeps;
}) {
  if (input.role === "admin") return true;
  if (input.role === "tenant") return input.booking.guest_user_id === input.userId;
  if (input.booking.host_user_id === input.userId) return true;
  if (input.role === "agent") {
    return input.deps.hasActiveDelegation(input.supabase, input.userId, input.booking.host_user_id);
  }
  return false;
}

export async function getShortletBookingNoteResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: ShortletBookingNoteRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Booking id required" }, { status: 422 });
  }

  let booking: BookingRow | null = null;
  try {
    booking = await deps.loadBooking(auth.supabase, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const allowed = await canViewNotes({
    role: auth.role,
    userId: auth.user.id,
    booking,
    supabase: auth.supabase,
    deps,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const notes = await deps.listNotes(auth.supabase, id);
    return NextResponse.json({ ok: true, notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function postShortletBookingNoteResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: ShortletBookingNoteRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Booking id required" }, { status: 422 });
  }
  const parsedPayload = notePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid note payload" }, { status: 422 });
  }

  let booking: BookingRow | null = null;
  try {
    booking = await deps.loadBooking(auth.supabase, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.guest_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const note = await deps.insertNote({
      supabase: auth.supabase,
      bookingId: id,
      authorUserId: auth.user.id,
      role: "tenant",
      topic: parsedPayload.data.topic,
      message: parsedPayload.data.message,
    });

    await deps.createNotification({
      userId: booking.host_user_id,
      type: "shortlet_booking_host_update",
      title: `Guest note: ${booking.property_title || "Shortlet booking"}`,
      body: `${parsedPayload.data.topic.replace("_", " ")} · ${parsedPayload.data.message.slice(0, 120)}`,
      href: `/host/bookings?booking=${booking.id}#host-bookings`,
      dedupeKey: `shortlet_booking:${booking.id}:guest_note:${note.id}`,
    });

    const hostEmail = await deps.resolveUserEmail(booking.host_user_id);
    await deps.notifyHostGuestNote({
      hostUserId: booking.host_user_id,
      email: hostEmail,
      payload: {
        propertyTitle: booking.property_title || "Shortlet listing",
        city: booking.city || null,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        nights: booking.nights,
        amountMinor: booking.total_amount_minor,
        currency: booking.currency,
        bookingId: booking.id,
        topic: parsedPayload.data.topic,
        message: parsedPayload.data.message,
        guestLabel: "Guest",
      },
    });

    return NextResponse.json({ ok: true, note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save booking note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return getShortletBookingNoteResponse(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return postShortletBookingNoteResponse(request, context);
}
