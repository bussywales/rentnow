import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getUserRole, requireOwnership, requireUser } from "@/lib/authz";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { dispatchSavedSearchAlerts } from "@/lib/alerts/tenant-alerts";
import { logFailure, logPlanLimitHit } from "@/lib/observability";
import { orderImagesWithCover } from "@/lib/properties/images";
import { getListingAccessResult } from "@/lib/role-access";
import { normalizeRole } from "@/lib/roles";
import { normalizeCountryForUpdate } from "@/lib/properties/country-normalize";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import {
  mapZodErrorToFieldErrors,
  optionalIntNonnegative,
  optionalNonnegativeNumber,
  optionalPositiveNumber,
  optionalYearBuilt,
  hasPinnedLocation,
} from "@/lib/properties/validation";
import { sanitizeImageMeta } from "@/lib/properties/image-meta";
import { sanitizeExifMeta } from "@/lib/properties/image-exif";
import {
  getDedupeWindowStart,
  isPrefetchRequest,
  shouldRecordPropertyView,
  shouldSkipInflightView,
  shortenId,
} from "@/lib/analytics/property-views";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { fetchLatestCheckins, buildCheckinSignal } from "@/lib/properties/checkin-signal";
import { cleanNullableString } from "@/lib/strings";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import type { UserRole } from "@/lib/types";
import {
  canShowExpiredListingPublic,
  computeExpiryAt,
  isListingPubliclyVisible,
} from "@/lib/properties/expiry";
import { getListingExpiryDays } from "@/lib/properties/expiry.server";
import { requireLegalAcceptance } from "@/lib/legal/guard.server";
import { isSaleIntent, normalizeListingIntent } from "@/lib/listing-intents";

const routeLabel = "/api/properties/[id]";
type ImageMetaPayload = Record<
  string,
  {
    width?: number;
    height?: number;
    bytes?: number;
    format?: string | null;
    exif?: { hasGps?: boolean | null; capturedAt?: string | null };
  }
>;
export const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  city: z.string().min(2).optional(),
  country: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
  state_region: z.string().optional().nullable(),
  admin_area_1: z.string().optional().nullable(),
  admin_area_2: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  neighbourhood: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  location_label: z.string().max(255).optional().nullable(),
  location_place_id: z.string().max(255).optional().nullable(),
  location_source: z.string().max(50).optional().nullable(),
  location_precision: z.string().max(50).optional().nullable(),
  listing_type: z
    .enum([
      "apartment",
      "condo",
      "house",
      "duplex",
      "bungalow",
      "studio",
      "room",
      "student",
      "hostel",
      "shop",
      "office",
      "land",
    ])
    .optional()
    .nullable(),
  rental_type: z.enum(["short_let", "long_term"]).optional(),
  listing_intent: z
    .enum(["rent", "buy", "rent_lease", "sale", "shortlet", "off_plan"])
    .optional()
    .nullable(),
  price: z.number().positive().optional(),
  currency: z.string().min(2).optional(),
  rent_period: z.enum(["monthly", "yearly"]).optional().nullable(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  bathroom_type: z.enum(["private", "shared"]).optional().nullable(),
  furnished: z.boolean().optional(),
  size_value: optionalPositiveNumber(),
  size_unit: z.enum(["sqm", "sqft"]).optional().nullable(),
  year_built: optionalYearBuilt(),
  deposit_amount: optionalNonnegativeNumber(),
  deposit_currency: z.string().min(2).optional().nullable(),
  pets_allowed: z.boolean().optional(),
  amenities: z.array(z.string()).optional().nullable(),
  available_from: z.string().optional().nullable(),
  max_guests: optionalIntNonnegative(),
  bills_included: z.boolean().optional(),
  epc_rating: z.string().optional().nullable(),
  council_tax_band: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  status: z
    .enum([
      "draft",
      "pending",
      "live",
      "rejected",
      "paused",
      "paused_owner",
      "paused_occupied",
      "expired",
      "changes_requested",
    ])
    .optional(),
  rejection_reason: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  is_demo: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  cover_image_url: z.string().url().optional().nullable(),
  imageMeta: z
    .preprocess(
      (val) => (val === null ? undefined : val),
      z
        .record(
          z.string(),
          z.object({
            width: z.number().int().positive().optional(),
            height: z.number().int().positive().optional(),
            bytes: z.number().int().nonnegative().optional(),
            format: z.string().optional().nullable(),
            exif: z
              .object({
                hasGps: z.boolean().optional().nullable(),
                capturedAt: z.string().optional().nullable(),
              })
              .optional(),
          })
        )
        .optional()
    ),
  paused_reason: z.string().optional().nullable(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveViewerContext(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { viewerId: null, viewerRole: "anon" };
  const role = await getUserRole(supabase, user.id);
  return { viewerId: user.id, viewerRole: normalizeRole(role) ?? "anon" };
}

const logViewDecision = ({
  recorded,
  reason,
  propertyId,
  viewerId,
  viewerRole,
}: {
  recorded: boolean;
  reason: string;
  propertyId: string;
  viewerId?: string | null;
  viewerRole: string;
}) => {
  console.info(
    JSON.stringify({
      event: "property_view",
      recorded,
      reason,
      property_id: shortenId(propertyId),
      viewer_id: shortenId(viewerId),
      viewer_role: viewerRole,
    })
  );
};

async function recordPropertyView({
  propertyId,
  ownerId,
  viewerId,
  viewerRole,
}: {
  propertyId: string;
  ownerId?: string | null;
  viewerId?: string | null;
  viewerRole: string;
}) {
  if (!hasServiceRoleEnv()) return;
  if (viewerId && ownerId && viewerId === ownerId) {
    logViewDecision({
      recorded: false,
      reason: "owner_skipped",
      propertyId,
      viewerId,
      viewerRole,
    });
    return;
  }
  try {
    const serviceClient = createServiceRoleClient();
    const adminDb = serviceClient as unknown as UntypedAdminClient;
    const now = new Date();
    let lastViewedAt: string | null = null;

    if (viewerId) {
      const inflightKey = `${propertyId}:${viewerId}`;
      if (shouldSkipInflightView({ key: inflightKey, nowMs: now.getTime() })) {
        logViewDecision({
          recorded: false,
          reason: "deduped_inflight",
          propertyId,
          viewerId,
          viewerRole,
        });
        return;
      }
      const windowStart = getDedupeWindowStart(now);
      const { data, error } = await adminDb
        .from<{ created_at: string }>("property_views")
        .select("created_at")
        .eq("property_id", propertyId)
        .eq("viewer_id", viewerId)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .range(0, 0);
      if (error) {
        console.warn("Property view dedupe lookup failed", {
          route: routeLabel,
          propertyId,
          error: error.message ?? "unknown_error",
        });
      } else {
        lastViewedAt = data?.[0]?.created_at ?? null;
      }
    }

    if (
      !shouldRecordPropertyView({
        viewerId,
        ownerId,
        lastViewedAt,
        now,
      })
    ) {
      logViewDecision({
        recorded: false,
        reason: "deduped_60s",
        propertyId,
        viewerId,
        viewerRole,
      });
      return;
    }

    await adminDb.from("property_views").insert({
      property_id: propertyId,
      viewer_id: viewerId ?? null,
      viewer_role: viewerRole,
    });
    logViewDecision({
      recorded: true,
      reason: viewerId ? "recorded" : "anonymous",
      propertyId,
      viewerId,
      viewerRole,
    });
  } catch (err) {
    console.warn("Property view insert failed", {
      route: routeLabel,
      propertyId,
      error: err instanceof Error ? err.message : "unknown_error",
    });
  }
}

const getAnonEnv = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

async function createRequestSupabaseClient(accessToken?: string | null) {
  const env = accessToken ? getAnonEnv() : null;
  if (accessToken && env) {
    return createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }
  return createServerSupabaseClient();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; properties are read-only in demo mode." },
      { status: 503 }
    );
  }

  const { id } = idParamSchema.parse(await context.params);
  const isUuid = uuidRegex.test(id);
  if (id === "undefined" || id === "null" || (!isUuid && !id.startsWith("mock-"))) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: "Invalid property id",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const source = searchParams.get("source") || searchParams.get("from");
  const ownerOnly = scope === "own";

  const missingPosition = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("position") &&
    message.includes("property_images");

  const buildQuery = (includePosition: boolean) => {
    const baseFields =
      "id, image_url, created_at, width, height, bytes, format, blurhash, exif_has_gps, exif_captured_at";
    const imageFields = includePosition
      ? `position, ${baseFields}`
      : baseFields;
    let query = supabase
      .from("properties")
      .select(
        `*, property_images(${imageFields}), property_videos(id, video_url, storage_path, bytes, format, created_at, updated_at), shortlet_settings(property_id,booking_mode,nightly_price_minor)`
      )
      .eq("id", id);
    if (includePosition) {
      query = query
        .order("position", { foreignTable: "property_images", ascending: true })
        .order("created_at", { foreignTable: "property_images", ascending: true });
    } else {
      query = query.order("created_at", {
        foreignTable: "property_images",
        ascending: true,
      });
    }
    return query.maybeSingle();
  };

  let { data, error } = await buildQuery(true);
  if (error && missingPosition(error.message)) {
    const fallback = await buildQuery(false);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: "Property not found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const now = new Date();
  const showExpiredPublic = await getAppSettingBool("show_expired_listings_public", false);
  const { viewerId, viewerRole } = await resolveViewerContext(supabase);
  const normalizedViewerRole: UserRole | null =
    viewerRole === "anon" ? null : (viewerRole as UserRole);
  const includeDemoListings = includeDemoListingsForViewer({
    viewerRole: normalizedViewerRole,
  });
  const isDemoHiddenForViewer =
    !!(data as { is_demo?: boolean | null }).is_demo && !includeDemoListings;
  const isPublicActive = isListingPubliclyVisible(data, now);
  const allowExpiredPublic = canShowExpiredListingPublic(data, showExpiredPublic, now);
  const isPublic = (isPublicActive || allowExpiredPublic) && !isDemoHiddenForViewer;

  if (ownerOnly || !isPublic) {
    const auth = await requireUser({
      request,
      route: routeLabel,
      startTime,
      supabase,
    });
    if (!auth.ok) return auth.response;

    const role = await getUserRole(supabase, auth.user.id);
    const ownership = requireOwnership({
      request,
      route: routeLabel,
      startTime,
      resourceOwnerId: data.owner_id,
      userId: auth.user.id,
      role,
      allowRoles: ["admin"],
    });
    if (!ownership.ok) {
      if (role === "agent") {
        const allowed = await hasActiveDelegation(supabase, auth.user.id, data.owner_id);
        if (!allowed) return ownership.response;
      } else {
        return ownership.response;
      }
    }
  }

  if (isPrefetchRequest(request.headers)) {
    logViewDecision({
      recorded: false,
      reason: "prefetch_skipped",
      propertyId: data.id,
      viewerId,
      viewerRole,
    });
  } else {
    void recordPropertyView({
      propertyId: data.id,
      ownerId: data.owner_id,
      viewerId,
      viewerRole,
    });
    if (!viewerId || viewerId !== data.owner_id) {
      const sessionKey = resolveEventSessionKey({ request, userId: viewerId });
      void logPropertyEvent({
        supabase,
        propertyId: data.id,
        eventType: "property_view",
        actorUserId: viewerId ?? null,
        actorRole: viewerRole,
        sessionKey,
        meta: source ? { source } : null,
      });
    }
  }

  const orderedImages = orderImagesWithCover(
    (data as { cover_image_url?: string | null }).cover_image_url ?? null,
    (data as { property_images?: Array<{ id: string; image_url: string; position?: number; created_at?: string }> }).property_images
  );
  const propertyVideos =
    (data as {
      property_videos?: Array<{
        id: string;
        video_url: string;
        storage_path?: string | null;
        bytes?: number | null;
        format?: string | null;
        created_at?: string | null;
        updated_at?: string | null;
      }>;
    }).property_videos ?? null;

  const flagEnabled = await getAppSettingBool("show_tenant_checkin_badge", false);
  const effectiveFlag =
    flagEnabled || viewerRole === "admin" || viewerRole === "landlord" || viewerRole === "agent";
  const latestCheckins = await fetchLatestCheckins([data.id]);
  const checkinSignal = buildCheckinSignal(latestCheckins.get(data.id) ?? null, {
    flagEnabled: effectiveFlag,
  });

  return NextResponse.json({
    property: { ...data, property_images: orderedImages, property_videos: propertyVideos, checkin_signal: checkinSignal },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; editing requires a live backend." },
      { status: 503 }
    );
  }

  const { id } = idParamSchema.parse(await context.params);
  try {
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    const supabase = await createRequestSupabaseClient(bearerToken);
    const auth = await requireUser({
      request,
      route: routeLabel,
      startTime,
      supabase,
      accessToken: bearerToken,
    });
    if (!auth.ok) {
      logFailure({
        request,
        route: routeLabel,
        status: 401,
        startTime,
        error: "not_authenticated",
      });
      return NextResponse.json(
        { error: "Please log in to manage listings.", code: "not_authenticated" },
        { status: 401 }
      );
    }

    const role = await getUserRole(supabase, auth.user.id);
    const access = getListingAccessResult(role, true);
    if (!access.ok) {
      logFailure({
        request,
        route: routeLabel,
        status: access.status,
        startTime,
        error: new Error(access.message),
      });
      return NextResponse.json(
        { error: access.message, code: access.code },
        { status: access.status }
      );
    }
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const missingStatus = (message?: string | null) =>
      typeof message === "string" && message.includes("properties.status");

    const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
    let existing: {
      owner_id: string;
      status?: string | null;
      is_active?: boolean | null;
      is_approved?: boolean | null;
      approved_at?: string | null;
    } | null = null;
    let fetchError: { message: string } | null = null;
    let statusMissing = false;

    if (adminClient) {
      const initial = await adminClient
        .from("properties")
        .select("owner_id, status, is_active, is_approved, approved_at")
        .eq("id", id)
        .maybeSingle();
      if (initial.error && missingStatus(initial.error.message)) {
        statusMissing = true;
        const fallback = await adminClient
          .from("properties")
          .select("owner_id, is_active, is_approved, approved_at")
          .eq("id", id)
          .maybeSingle();
        existing = fallback.data ?? null;
        fetchError = fallback.error;
      } else {
        existing = (initial.data as { owner_id: string } | null) ?? null;
        fetchError = initial.error;
      }
    } else {
      const initial = await supabase
        .from("properties")
        .select("owner_id, status, is_active, is_approved, approved_at")
        .eq("id", id)
        .maybeSingle();
      if (initial.error && missingStatus(initial.error.message)) {
        statusMissing = true;
        const fallback = await supabase
          .from("properties")
          .select("owner_id, is_active, is_approved, approved_at")
          .eq("id", id)
          .maybeSingle();
        existing = fallback.data ?? null;
        fetchError = fallback.error;
      } else {
        existing = (initial.data as { owner_id: string } | null) ?? null;
        fetchError = initial.error;
      }
    }

    if (fetchError) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(fetchError.message),
      });
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    if (!existing) {
      logFailure({
        request,
        route: routeLabel,
        status: 404,
        startTime,
        error: "Property not found",
      });
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (statusMissing) {
      return NextResponse.json(
        {
          error: "DB migration required: properties.status",
          missingColumn: "properties.status",
          migration: "009_properties_workflow_columns.sql",
        },
        { status: 409 }
      );
    }
    const ownership = requireOwnership({
      request,
      route: routeLabel,
      startTime,
      resourceOwnerId: existing.owner_id,
      userId: auth.user.id,
      role,
      allowRoles: ["admin"],
    });
    if (!ownership.ok) {
      if (role === "agent") {
        const allowed = await hasActiveDelegation(supabase, auth.user.id, existing.owner_id);
        if (!allowed) return ownership.response;
      } else {
        return ownership.response;
      }
    }

    const body = await request.json();
    const updates = updateSchema.parse(body);
    const {
      imageUrls = [],
      status,
      rejection_reason,
      paused_reason,
      cover_image_url,
      imageMeta = {} as ImageMetaPayload,
      ...rest
    } = updates;
    const countryFields = normalizeCountryForUpdate({
      country: rest.country,
      country_code: rest.country_code,
    });
    const normalizedRest = {
      ...rest,
      listing_intent:
        typeof rest.listing_intent === "undefined"
          ? undefined
          : normalizeListingIntent(rest.listing_intent) ?? "rent_lease",
      listing_type: typeof rest.listing_type === "undefined" ? undefined : rest.listing_type,
      country: countryFields.country,
      country_code: countryFields.country_code,
      state_region: typeof rest.state_region === "undefined" ? undefined : rest.state_region,
      admin_area_1: cleanNullableString(rest.admin_area_1),
      admin_area_2: cleanNullableString(rest.admin_area_2),
      postal_code: cleanNullableString(rest.postal_code),
      location_label: cleanNullableString(rest.location_label),
      location_place_id: cleanNullableString(rest.location_place_id),
      location_source: cleanNullableString(rest.location_source),
      location_precision: cleanNullableString(rest.location_precision),
      size_value: typeof rest.size_value === "undefined" ? undefined : rest.size_value,
      size_unit:
        typeof rest.size_value === "number"
          ? rest.size_unit ?? "sqm"
          : typeof rest.size_unit === "undefined"
            ? undefined
            : null,
      year_built: typeof rest.year_built === "undefined" ? undefined : rest.year_built,
      deposit_amount:
        typeof rest.deposit_amount === "undefined" ? undefined : rest.deposit_amount,
      deposit_currency:
        typeof rest.deposit_amount === "number"
          ? rest.deposit_currency ?? rest.currency ?? null
          : typeof rest.deposit_currency === "undefined"
            ? undefined
            : null,
      bathroom_type:
        typeof rest.bathroom_type === "undefined" ? undefined : rest.bathroom_type,
      pets_allowed: typeof rest.pets_allowed === "undefined" ? undefined : rest.pets_allowed,
      cover_image_url:
        typeof cover_image_url === "undefined"
          ? undefined
          : cover_image_url ?? (imageUrls[0] ?? null),
    };
    if (
      isSaleIntent(normalizedRest.listing_intent) ||
      normalizedRest.listing_intent === "off_plan"
    ) {
      normalizedRest.deposit_amount = null;
      normalizedRest.deposit_currency = null;
      normalizedRest.bills_included = false;
      normalizedRest.rent_period = null;
    }
    if (typeof normalizedRest.cover_image_url === "string" && imageUrls.length && !imageUrls.includes(normalizedRest.cover_image_url)) {
      return NextResponse.json(
        { error: "Cover photo must be one of the uploaded photos." },
        { status: 400 }
      );
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const isAdmin = role === "admin";
    let statusUpdate: Record<string, unknown> = {};
    const statusTarget = status || (normalizedRest.is_active ? "pending" : undefined);

    if (status) {
      const allowed = isAdmin
        ? [
            "draft",
            "pending",
            "live",
            "rejected",
            "paused",
            "paused_owner",
            "paused_occupied",
            "expired",
            "changes_requested",
          ]
        : ["draft", "pending", "paused", "paused_owner", "paused_occupied"];
      if (!allowed.includes(status)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const isPausedStatus = ["paused", "paused_owner", "paused_occupied"].includes(status);
      const wasPausedStatus = ["paused", "paused_owner", "paused_occupied"].includes(
        (existing?.status ?? "").toString().toLowerCase()
      );
      statusUpdate = {
        status,
        status_updated_at: nowIso,
        rejection_reason:
          status === "rejected" ? rejection_reason || "Rejected by admin" : null,
        submitted_at: status === "pending" ? nowIso : null,
        approved_at: status === "live" ? nowIso : isPausedStatus ? existing?.approved_at ?? null : null,
        rejected_at: status === "rejected" ? nowIso : null,
        paused_at: isPausedStatus ? nowIso : null,
        paused_reason: isPausedStatus ? cleanNullableString(paused_reason, { allowUndefined: false }) : null,
        is_active: status === "pending" || status === "live",
        is_approved: isPausedStatus ? existing?.is_approved ?? false : status === "live",
      };
      if (status === "live" && wasPausedStatus) {
        statusUpdate = { ...statusUpdate, reactivated_at: nowIso };
      }
      if (status === "live") {
        const expiryDays = await getListingExpiryDays();
        statusUpdate = {
          ...statusUpdate,
          expires_at: computeExpiryAt(now, expiryDays),
          expired_at: null,
        };
      }
    } else if (typeof rejection_reason !== "undefined" && isAdmin) {
      statusUpdate = { rejection_reason };
    }

    const wasActive = existing.is_active ?? false;
    const requestedActive =
      typeof status !== "undefined"
        ? status === "pending" || status === "live"
        : typeof updates.is_active === "boolean"
          ? updates.is_active
          : wasActive;
    const willActivate = requestedActive && !wasActive;
    const isPublishAttempt = statusTarget === "pending" || statusTarget === "live" || requestedActive;

    if (!isAdmin && isPublishAttempt) {
      const legalCheck = await requireLegalAcceptance({
        request,
        supabase,
        userId: auth.user.id,
        role,
      });
      if (!legalCheck.ok) {
        return legalCheck.response;
      }
    }

    if (
      !isAdmin &&
      isPublishAttempt &&
      (await getAppSettingBool("require_location_pin_for_publish", false)) &&
      !hasPinnedLocation({
        latitude: normalizedRest.latitude,
        longitude: normalizedRest.longitude,
        location_label: normalizedRest.location_label as string | null | undefined,
        location_place_id: normalizedRest.location_place_id as string | null | undefined,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pin a location to publish this listing.",
          code: "LOCATION_PIN_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (!isAdmin && willActivate) {
      const usage = await getPlanUsage({
        supabase,
        ownerId: existing.owner_id,
        serviceClient: adminClient,
        excludeId: id,
      });
      if (usage.error) {
        logFailure({
          request,
          route: routeLabel,
          status: 500,
          startTime,
          error: new Error(usage.error),
        });
        return NextResponse.json({ error: usage.error }, { status: 500 });
      }
      if (usage.activeCount >= usage.plan.maxListings) {
        logPlanLimitHit({
          request,
          route: routeLabel,
          actorId: auth.user.id,
          ownerId: existing.owner_id,
          propertyId: id,
          planTier: usage.plan.tier,
          maxListings: usage.plan.maxListings,
          activeCount: usage.activeCount,
          source: usage.source,
        });
        return NextResponse.json(
          {
            error: "Plan limit reached",
            code: "plan_limit_reached",
            maxListings: usage.plan.maxListings,
            activeCount: usage.activeCount,
            planTier: usage.plan.tier,
          },
          { status: 409 }
        );
      }
    }

    const { error: updateError } = await supabase
      .from("properties")
      .update({
        ...normalizedRest,
        amenities: rest.amenities ?? [],
        features: rest.features ?? [],
        updated_at: new Date().toISOString(),
        ...statusUpdate,
      })
      .eq("id", id);

    if (updateError) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(updateError.message),
      });
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    if (imageUrls) {
      await supabase.from("property_images").delete().eq("property_id", id);
      if (imageUrls.length) {
        await supabase.from("property_images").insert(
          imageUrls.map((url, index) => {
            const metaForUrl = imageMeta?.[url] as
              | ({ exif?: { hasGps?: boolean | null; capturedAt?: string | null } } & object)
              | undefined;
            return {
              property_id: id,
              image_url: url,
              position: index,
              ...sanitizeImageMeta(imageMeta?.[url]),
              ...sanitizeExifMeta(metaForUrl?.exif),
            };
          })
        );
      }
    }

    if (willActivate) {
      const { data: updated } = await supabase
        .from("properties")
        .select("id, is_active, is_approved")
        .eq("id", id)
        .maybeSingle();
      if (updated?.is_active && updated?.is_approved) {
        try {
          const alertResult = await dispatchSavedSearchAlerts(id);
          if (!alertResult.ok) {
            logFailure({
              request,
              route: routeLabel,
              status: alertResult.status ?? 500,
              startTime,
              error: new Error(alertResult.error ?? "Alert dispatch failed"),
            });
          }
        } catch (err) {
          logFailure({
            request,
            route: routeLabel,
            status: 500,
            startTime,
            error: err,
          });
        }
      }
    }

    return NextResponse.json({ id });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const fieldErrors = mapZodErrorToFieldErrors(error);
      return NextResponse.json(
        { error: "Please correct the highlighted fields.", fieldErrors },
        { status: 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Unable to update property";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; deletion is unavailable in demo mode." },
      { status: 503 }
    );
  }

  const { id } = idParamSchema.parse(await context.params);
  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: routeLabel,
    startTime,
    supabase,
  });
  if (!auth.ok) {
    logFailure({
      request,
      route: routeLabel,
      status: 401,
      startTime,
      error: "not_authenticated",
    });
    return NextResponse.json(
      { error: "Please log in to manage listings.", code: "not_authenticated" },
      { status: 401 }
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: "Property not found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const role = await getUserRole(supabase, auth.user.id);
  const access = getListingAccessResult(role, true);
  if (!access.ok) {
    logFailure({
      request,
      route: routeLabel,
      status: access.status,
      startTime,
      error: new Error(access.message),
    });
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status }
    );
  }
  const ownership = requireOwnership({
    request,
    route: routeLabel,
    startTime,
    resourceOwnerId: existing.owner_id,
    userId: auth.user.id,
    role,
    allowRoles: ["admin"],
  });
  if (!ownership.ok) {
    if (role === "agent") {
      const allowed = await hasActiveDelegation(supabase, auth.user.id, existing.owner_id);
      if (!allowed) return ownership.response;
    } else {
      return ownership.response;
    }
  }

  const { error } = await supabase.from("properties").delete().eq("id", id);

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id });
}
