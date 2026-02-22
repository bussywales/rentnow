import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { canHostManageShortletBooking } from "@/lib/shortlet/access";
import { resolveShortletManageState } from "@/lib/shortlet/manage-state";

const routeLabel = "/api/shortlet/settings/[propertyId]";

const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const timeValueSchema = z.string().trim().regex(TIME_VALUE_PATTERN);

const payloadSchema = z.object({
  booking_mode: z.enum(["instant", "request"]),
  nightly_price_minor: z.number().int().positive(),
  cancellation_policy: z
    .enum(["flexible_24h", "flexible_48h", "moderate_5d", "strict"])
    .optional(),
  cleaning_fee_minor: z.number().int().min(0).optional(),
  deposit_minor: z.number().int().min(0).optional(),
  min_nights: z.number().int().min(1).optional(),
  max_nights: z.number().int().min(1).nullable().optional(),
  advance_notice_hours: z.number().int().min(0).optional(),
  prep_days: z.number().int().min(0).optional(),
  checkin_instructions: z.string().trim().max(4000).nullable().optional(),
  checkin_window_start: timeValueSchema.nullable().optional(),
  checkin_window_end: timeValueSchema.nullable().optional(),
  checkout_time: timeValueSchema.nullable().optional(),
  access_method: z.string().trim().max(120).nullable().optional(),
  access_code_hint: z.string().trim().max(500).nullable().optional(),
  parking_info: z.string().trim().max(2000).nullable().optional(),
  wifi_info: z.string().trim().max(2000).nullable().optional(),
  house_rules: z.string().trim().max(4000).nullable().optional(),
  quiet_hours_start: timeValueSchema.nullable().optional(),
  quiet_hours_end: timeValueSchema.nullable().optional(),
  pets_allowed: z.boolean().nullable().optional(),
  smoking_allowed: z.boolean().nullable().optional(),
  parties_allowed: z.boolean().nullable().optional(),
  max_guests_override: z.number().int().min(1).nullable().optional(),
  emergency_notes: z.string().trim().max(2000).nullable().optional(),
});

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const parsedBody = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid shortlet settings payload." }, { status: 422 });
  }

  const { propertyId } = await context.params;
  if (!propertyId) {
    return NextResponse.json({ error: "Property id is required." }, { status: 422 });
  }

  const payload = parsedBody.data;
  if (payload.max_nights !== null && typeof payload.max_nights === "number") {
    const minNights = payload.min_nights ?? 1;
    if (payload.max_nights < minNights) {
      return NextResponse.json(
        { error: "Max nights must be greater than or equal to min nights." },
        { status: 422 }
      );
    }
  }

  const viewerClient = await createServerSupabaseClient();
  const { data: propertyRow, error: propertyError } = await viewerClient
    .from("properties")
    .select(
      "id,owner_id,listing_intent,rental_type,currency,shortlet_settings(property_id,nightly_price_minor,booking_mode,cancellation_policy)"
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError || !propertyRow) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const shortletManageState = resolveShortletManageState({
    listing_intent: propertyRow.listing_intent,
    rental_type: propertyRow.rental_type,
    shortlet_settings: propertyRow.shortlet_settings as
      | Array<{
          booking_mode?: string | null;
          nightly_price_minor?: number | null;
          cancellation_policy?: string | null;
        }>
      | null
      | undefined,
    listing_currency: propertyRow.currency,
  });

  console.info("[api/shortlet/settings] guard", {
    role: auth.role,
    actorUserId: auth.user.id,
    listingId: propertyId,
    listingOwnerId: String(propertyRow.owner_id || ""),
    listingIntent: propertyRow.listing_intent ?? null,
    normalizedListingIntent: shortletManageState.normalizedListingIntent,
    rentalType: propertyRow.rental_type ?? null,
    hasShortletSignal: shortletManageState.hasShortletSignal,
    hasShortletSettingsSignal: shortletManageState.hasSettingsSignal,
    shortletManageable: shortletManageState.isManageable,
    shortletReason: shortletManageState.reason,
    listingCurrency: shortletManageState.listingCurrency,
  });

  if (!shortletManageState.isManageable) {
    return NextResponse.json(
      {
        error: "Only shortlet listings can use shortlet availability settings.",
        code: "SHORTLET_LISTING_REQUIRED",
        reason: shortletManageState.reason,
      },
      { status: 409 }
    );
  }

  let canManage = canHostManageShortletBooking({
    actorRole: auth.role,
    actorUserId: auth.user.id,
    hostUserId: String(propertyRow.owner_id || ""),
    hasDelegation: false,
  });

  if (!canManage && auth.role === "agent") {
    const delegated = await hasActiveDelegation(
      viewerClient,
      auth.user.id,
      String(propertyRow.owner_id || "")
    );
    canManage = canHostManageShortletBooking({
      actorRole: auth.role,
      actorUserId: auth.user.id,
      hostUserId: String(propertyRow.owner_id || ""),
      hasDelegation: delegated,
    });
  }

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createServiceRoleClient() as unknown as {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options: { onConflict: string }
      ) => {
        select: (columns: string) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
  const { data: updated, error: updateError } = await adminClient
    .from("shortlet_settings")
    .upsert(
      {
        property_id: propertyId,
        booking_mode: payload.booking_mode,
        nightly_price_minor: payload.nightly_price_minor,
        cancellation_policy: payload.cancellation_policy ?? "flexible_48h",
        cleaning_fee_minor: payload.cleaning_fee_minor ?? 0,
        deposit_minor: payload.deposit_minor ?? 0,
        min_nights: payload.min_nights ?? 1,
        max_nights: payload.max_nights ?? null,
        advance_notice_hours: payload.advance_notice_hours ?? 0,
        prep_days: payload.prep_days ?? 0,
        checkin_instructions: payload.checkin_instructions ?? null,
        checkin_window_start: payload.checkin_window_start ?? null,
        checkin_window_end: payload.checkin_window_end ?? null,
        checkout_time: payload.checkout_time ?? null,
        access_method: payload.access_method ?? null,
        access_code_hint: payload.access_code_hint ?? null,
        parking_info: payload.parking_info ?? null,
        wifi_info: payload.wifi_info ?? null,
        house_rules: payload.house_rules ?? null,
        quiet_hours_start: payload.quiet_hours_start ?? null,
        quiet_hours_end: payload.quiet_hours_end ?? null,
        pets_allowed:
          typeof payload.pets_allowed === "boolean" ? payload.pets_allowed : null,
        smoking_allowed:
          typeof payload.smoking_allowed === "boolean" ? payload.smoking_allowed : null,
        parties_allowed:
          typeof payload.parties_allowed === "boolean" ? payload.parties_allowed : null,
        max_guests_override:
          typeof payload.max_guests_override === "number"
            ? payload.max_guests_override
            : null,
        emergency_notes: payload.emergency_notes ?? null,
      },
      { onConflict: "property_id" }
    )
    .select(
      "property_id,booking_mode,nightly_price_minor,cancellation_policy,cleaning_fee_minor,deposit_minor,min_nights,max_nights,advance_notice_hours,prep_days,checkin_instructions,checkin_window_start,checkin_window_end,checkout_time,access_method,access_code_hint,parking_info,wifi_info,house_rules,quiet_hours_start,quiet_hours_end,pets_allowed,smoking_allowed,parties_allowed,max_guests_override,emergency_notes"
    )
    .maybeSingle();

  if (updateError || !updated) {
    const message =
      updateError?.message || "Unable to update shortlet settings. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    settings: {
      property_id: String(updated.property_id || ""),
      booking_mode: updated.booking_mode === "instant" ? "instant" : "request",
      nightly_price_minor: Number(updated.nightly_price_minor || 0),
      cancellation_policy:
        updated.cancellation_policy === "flexible_24h" ||
        updated.cancellation_policy === "flexible_48h" ||
        updated.cancellation_policy === "moderate_5d" ||
        updated.cancellation_policy === "strict"
          ? updated.cancellation_policy
          : "flexible_48h",
      cleaning_fee_minor: Number(updated.cleaning_fee_minor || 0),
      deposit_minor: Number(updated.deposit_minor || 0),
      min_nights: Number(updated.min_nights || 1),
      max_nights:
        typeof updated.max_nights === "number" ? Number(updated.max_nights) : null,
      advance_notice_hours: Number(updated.advance_notice_hours || 0),
      prep_days: Number(updated.prep_days || 0),
      checkin_instructions:
        typeof updated.checkin_instructions === "string"
          ? updated.checkin_instructions
          : null,
      checkin_window_start:
        typeof updated.checkin_window_start === "string"
          ? updated.checkin_window_start
          : null,
      checkin_window_end:
        typeof updated.checkin_window_end === "string"
          ? updated.checkin_window_end
          : null,
      checkout_time:
        typeof updated.checkout_time === "string" ? updated.checkout_time : null,
      access_method:
        typeof updated.access_method === "string" ? updated.access_method : null,
      access_code_hint:
        typeof updated.access_code_hint === "string" ? updated.access_code_hint : null,
      parking_info:
        typeof updated.parking_info === "string" ? updated.parking_info : null,
      wifi_info: typeof updated.wifi_info === "string" ? updated.wifi_info : null,
      house_rules:
        typeof updated.house_rules === "string" ? updated.house_rules : null,
      quiet_hours_start:
        typeof updated.quiet_hours_start === "string"
          ? updated.quiet_hours_start
          : null,
      quiet_hours_end:
        typeof updated.quiet_hours_end === "string"
          ? updated.quiet_hours_end
          : null,
      pets_allowed:
        typeof updated.pets_allowed === "boolean" ? updated.pets_allowed : null,
      smoking_allowed:
        typeof updated.smoking_allowed === "boolean"
          ? updated.smoking_allowed
          : null,
      parties_allowed:
        typeof updated.parties_allowed === "boolean"
          ? updated.parties_allowed
          : null,
      max_guests_override:
        typeof updated.max_guests_override === "number"
          ? Math.trunc(updated.max_guests_override)
          : null,
      emergency_notes:
        typeof updated.emergency_notes === "string" ? updated.emergency_notes : null,
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  return PATCH(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  return PATCH(request, context);
}
