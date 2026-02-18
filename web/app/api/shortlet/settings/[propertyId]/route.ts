import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { canHostManageShortletBooking } from "@/lib/shortlet/access";
import { resolveShortletManageState } from "@/lib/shortlet/manage-state";

const routeLabel = "/api/shortlet/settings/[propertyId]";

const payloadSchema = z.object({
  booking_mode: z.enum(["instant", "request"]),
  nightly_price_minor: z.number().int().positive(),
  cleaning_fee_minor: z.number().int().min(0).optional(),
  deposit_minor: z.number().int().min(0).optional(),
  min_nights: z.number().int().min(1).optional(),
  max_nights: z.number().int().min(1).nullable().optional(),
  advance_notice_hours: z.number().int().min(0).optional(),
  prep_days: z.number().int().min(0).optional(),
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
      "id,owner_id,listing_intent,rental_type,currency,shortlet_settings(property_id,nightly_price_minor,booking_mode)"
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
      | Array<{ booking_mode?: string | null; nightly_price_minor?: number | null }>
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
        cleaning_fee_minor: payload.cleaning_fee_minor ?? 0,
        deposit_minor: payload.deposit_minor ?? 0,
        min_nights: payload.min_nights ?? 1,
        max_nights: payload.max_nights ?? null,
        advance_notice_hours: payload.advance_notice_hours ?? 0,
        prep_days: payload.prep_days ?? 0,
      },
      { onConflict: "property_id" }
    )
    .select(
      "property_id,booking_mode,nightly_price_minor,cleaning_fee_minor,deposit_minor,min_nights,max_nights,advance_notice_hours,prep_days"
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
      cleaning_fee_minor: Number(updated.cleaning_fee_minor || 0),
      deposit_minor: Number(updated.deposit_minor || 0),
      min_nights: Number(updated.min_nights || 1),
      max_nights:
        typeof updated.max_nights === "number" ? Number(updated.max_nights) : null,
      advance_notice_hours: Number(updated.advance_notice_hours || 0),
      prep_days: Number(updated.prep_days || 0),
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
