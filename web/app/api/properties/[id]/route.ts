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
} from "@/lib/properties/validation";
import { sanitizeImageMeta } from "@/lib/properties/image-meta";
import {
  getDedupeWindowStart,
  isPrefetchRequest,
  shouldRecordPropertyView,
  shouldSkipInflightView,
  shortenId,
} from "@/lib/analytics/property-views";

const routeLabel = "/api/properties/[id]";
type ImageMetaPayload = Record<
  string,
  { width?: number; height?: number; bytes?: number; format?: string | null }
>;
const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  city: z.string().min(2).optional(),
  country: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
  state_region: z.string().optional().nullable(),
  neighbourhood: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  listing_type: z
    .enum(["apartment", "house", "duplex", "bungalow", "studio", "room", "shop", "office", "land"])
    .optional()
    .nullable(),
  rental_type: z.enum(["short_let", "long_term"]).optional(),
  price: z.number().positive().optional(),
  currency: z.string().min(2).optional(),
  rent_period: z.enum(["monthly", "yearly"]).optional(),
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
  status: z.enum(["draft", "pending", "live", "rejected", "paused"]).optional(),
  rejection_reason: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  cover_image_url: z.string().url().optional().nullable(),
  imageMeta: z
    .record(
      z.string(),
      z.object({
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        bytes: z.number().int().nonnegative().optional(),
        format: z.string().optional().nullable(),
      })
    )
    .optional(),
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
  const ownerOnly = scope === "own";

  const missingPosition = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("position") &&
    message.includes("property_images");

  const buildQuery = (includePosition: boolean) => {
    const imageFields = includePosition
      ? "id, image_url, position, created_at, width, height, bytes, format"
      : "id, image_url, created_at, width, height, bytes, format";
    let query = supabase
      .from("properties")
      .select(`*, property_images(${imageFields})`)
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

  const isPublic = data.is_approved === true && data.is_active === true;

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

  const { viewerId, viewerRole } = await resolveViewerContext(supabase);
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
  }

  const orderedImages = orderImagesWithCover(
    (data as { cover_image_url?: string | null }).cover_image_url ?? null,
    (data as { property_images?: Array<{ id: string; image_url: string; position?: number; created_at?: string }> }).property_images
  );

  return NextResponse.json({ property: { ...data, property_images: orderedImages } });
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

    const missingStatus = (message?: string | null) =>
      typeof message === "string" && message.includes("properties.status");

    const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
    let existing: {
      owner_id: string;
      status?: string | null;
      is_active?: boolean | null;
      is_approved?: boolean | null;
    } | null = null;
    let fetchError: { message: string } | null = null;
    let statusMissing = false;

    if (adminClient) {
      const initial = await adminClient
        .from("properties")
        .select("owner_id, status, is_active, is_approved")
        .eq("id", id)
        .maybeSingle();
      if (initial.error && missingStatus(initial.error.message)) {
        statusMissing = true;
        const fallback = await adminClient
          .from("properties")
          .select("owner_id, is_active, is_approved")
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
        .select("owner_id, status, is_active, is_approved")
        .eq("id", id)
        .maybeSingle();
      if (initial.error && missingStatus(initial.error.message)) {
        statusMissing = true;
        const fallback = await supabase
          .from("properties")
          .select("owner_id, is_active, is_approved")
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
      listing_type: typeof rest.listing_type === "undefined" ? undefined : rest.listing_type,
      country: countryFields.country,
      country_code: countryFields.country_code,
      state_region: typeof rest.state_region === "undefined" ? undefined : rest.state_region,
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
    if (typeof normalizedRest.cover_image_url === "string" && imageUrls.length && !imageUrls.includes(normalizedRest.cover_image_url)) {
      return NextResponse.json(
        { error: "Cover photo must be one of the uploaded photos." },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const isAdmin = role === "admin";
    let statusUpdate: Record<string, unknown> = {};

    if (status) {
      const allowed = isAdmin
        ? ["draft", "pending", "live", "rejected", "paused"]
        : ["draft", "pending", "paused"];
      if (!allowed.includes(status)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      statusUpdate = {
        status,
        rejection_reason:
          status === "rejected" ? rejection_reason || "Rejected by admin" : null,
        submitted_at: status === "pending" ? now : null,
        approved_at: status === "live" ? now : null,
        rejected_at: status === "rejected" ? now : null,
        paused_at: status === "paused" ? now : null,
        is_active: status === "pending" || status === "live",
        is_approved: status === "live",
      };
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
          imageUrls.map((url, index) => ({
            property_id: id,
            image_url: url,
            position: index,
            ...sanitizeImageMeta(imageMeta?.[url]),
          }))
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
