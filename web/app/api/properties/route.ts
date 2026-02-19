import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { getListingAccessResult } from "@/lib/role-access";
import { normalizeRole } from "@/lib/roles";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import { logFailure, logPlanLimitHit } from "@/lib/observability";
import { normalizeCountryForCreate } from "@/lib/properties/country-normalize";
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
import { fetchLatestCheckins, buildCheckinSignal } from "@/lib/properties/checkin-signal";
import { cleanNullableString } from "@/lib/strings";
import { computeExpiryAt } from "@/lib/properties/expiry";
import { getListingExpiryDays } from "@/lib/properties/expiry.server";
import { requireLegalAcceptance } from "@/lib/legal/guard.server";
import { isSaleIntent, normalizeListingIntent } from "@/lib/listing-intents";
import {
  resolveRentalTypeForListingIntent,
  resolveShortletPersistenceInput,
} from "@/lib/shortlet/listing-setup";

const routeLabel = "/api/properties";
type ImageMetaPayload = Record<
  string,
  {
    width?: number;
    height?: number;
    bytes?: number;
    format?: string | null;
    blurhash?: string | null;
    storage_path?: string | null;
    original_storage_path?: string | null;
    thumb_storage_path?: string | null;
    card_storage_path?: string | null;
    hero_storage_path?: string | null;
  }
>;
// Exported for tests to validate draft vs publish payloads.
export const propertySchema = z
  .object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  city: z.string().min(2),
  country: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
  state_region: z.string().optional().nullable(),
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
  rental_type: z.enum(["short_let", "long_term"]),
  listing_intent: z
    .enum(["rent", "buy", "rent_lease", "sale", "shortlet", "off_plan"])
    .optional()
    .nullable(),
  price: z.number().positive(),
  currency: z.string().min(2),
  shortlet_nightly_price_minor: z.number().int().positive().optional().nullable(),
  shortlet_booking_mode: z.enum(["instant", "request"]).optional().nullable(),
  rent_period: z.enum(["monthly", "yearly"]).optional().nullable(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  bathroom_type: z.enum(["private", "shared"]).optional().nullable(),
  furnished: z.boolean(),
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
  is_active: z.boolean().optional(),
  is_demo: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  cover_image_url: z.string().url().optional().nullable(),
  admin_area_1: z.string().optional().nullable(),
  admin_area_2: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
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
            storage_path: z.string().optional().nullable(),
            original_storage_path: z.string().optional().nullable(),
            thumb_storage_path: z.string().optional().nullable(),
            card_storage_path: z.string().optional().nullable(),
            hero_storage_path: z.string().optional().nullable(),
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
  });

export async function POST(request: Request) {
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
      { error: "Supabase is not configured; listing creation is unavailable in demo mode." },
      { status: 503 }
    );
  }

  try {
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

    const user = auth.user;
    const role = await getUserRole(supabase, user.id);
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
    const actingAs = readActingAsFromRequest(request as NextRequest);
    let ownerId = user.id;

    if (role === "agent" && actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      ownerId = actingAs;
    }

    const body = await request.json();
    const data = propertySchema.parse(body);
    const {
      imageUrls = [],
      status,
      cover_image_url,
      imageMeta = {} as ImageMetaPayload,
      shortlet_nightly_price_minor,
      shortlet_booking_mode,
      ...rest
    } = data;
    const normalizedDepositCurrency =
      typeof rest.deposit_amount === "number"
        ? rest.deposit_currency ?? rest.currency
        : null;
    const normalizedSizeUnit =
      typeof rest.size_value === "number" ? rest.size_unit ?? "sqm" : null;
    const { country, country_code } = normalizeCountryForCreate({
      country: rest.country,
      country_code: rest.country_code,
    });
    const normalized = {
      ...rest,
      location_label: cleanNullableString(rest.location_label, { allowUndefined: false }),
      location_place_id: cleanNullableString(rest.location_place_id, { allowUndefined: false }),
      location_source: cleanNullableString(rest.location_source, { allowUndefined: false }),
      location_precision: cleanNullableString(rest.location_precision, { allowUndefined: false }),
      listing_intent: normalizeListingIntent(rest.listing_intent) ?? "rent_lease",
      listing_type: rest.listing_type ?? null,
      country,
      country_code,
      state_region: rest.state_region ?? null,
      admin_area_1: cleanNullableString(rest.admin_area_1, { allowUndefined: false }),
      admin_area_2: cleanNullableString(rest.admin_area_2, { allowUndefined: false }),
      postal_code: cleanNullableString(rest.postal_code, { allowUndefined: false }),
      size_value: typeof rest.size_value === "number" ? rest.size_value : null,
      size_unit: normalizedSizeUnit,
      year_built: typeof rest.year_built === "number" ? rest.year_built : null,
      deposit_amount: typeof rest.deposit_amount === "number" ? rest.deposit_amount : null,
      deposit_currency: normalizedDepositCurrency,
      bathroom_type: rest.bathroom_type ?? null,
      pets_allowed: typeof rest.pets_allowed === "boolean" ? rest.pets_allowed : false,
      cover_image_url: cover_image_url ?? (imageUrls[0] ?? null),
    };
    const shortletPersistence = resolveShortletPersistenceInput({
      listingIntent: normalized.listing_intent,
      rentalType: normalized.rental_type,
      nightlyPriceMinor: shortlet_nightly_price_minor,
      bookingMode: shortlet_booking_mode,
      fallbackPrice: normalized.price,
    });
    normalized.rental_type = resolveRentalTypeForListingIntent(
      normalized.listing_intent,
      normalized.rental_type
    );
    if (shortletPersistence.isShortlet) {
      normalized.rent_period = null;
      if (!shortletPersistence.nightlyPriceMinor && typeof normalized.price === "number") {
        shortletPersistence.nightlyPriceMinor = normalized.price;
      }
    }
    if (isSaleIntent(normalized.listing_intent) || normalized.listing_intent === "off_plan") {
      normalized.deposit_amount = null;
      normalized.deposit_currency = null;
      normalized.bills_included = false;
      normalized.rent_period = null;
    }
    if (normalized.cover_image_url && imageUrls.length && !imageUrls.includes(normalized.cover_image_url)) {
      return NextResponse.json(
        { error: "Cover photo must be one of the uploaded photos." },
        { status: 400 }
      );
    }
    const isAdmin = role === "admin";
    const normalizedStatus = isAdmin && status ? status : "draft";
    const isActive = normalizedStatus === "pending" || normalizedStatus === "live";
    const isApproved = normalizedStatus === "live";
    const now = new Date();
    const nowIso = now.toISOString();
    const submittedAt = normalizedStatus === "pending" ? nowIso : null;
    const approvedAt = normalizedStatus === "live" ? nowIso : null;
    const expiryDays =
      normalizedStatus === "live" ? await getListingExpiryDays() : null;
    const expiresAt =
      normalizedStatus === "live" && expiryDays
        ? computeExpiryAt(now, expiryDays)
        : null;
    const willPublish = !isAdmin && isActive;

    if (willPublish) {
      const legalCheck = await requireLegalAcceptance({
        request,
        supabase,
        userId: user.id,
        role,
      });
      if (!legalCheck.ok) {
        return legalCheck.response;
      }
    }

    if (
      willPublish &&
      (await getAppSettingBool("require_location_pin_for_publish", false)) &&
      !hasPinnedLocation({
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        location_label: normalized.location_label,
        location_place_id: normalized.location_place_id,
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

    if (!isAdmin && isActive) {
      const serviceClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
      const usage = await getPlanUsage({
        supabase,
        ownerId,
        serviceClient,
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
          actorId: user.id,
          ownerId,
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

    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert({
        ...normalized,
        amenities: rest.amenities ?? [],
        features: rest.features ?? [],
        status: normalizedStatus,
        is_active: isActive,
        is_approved: isApproved,
        submitted_at: submittedAt,
        approved_at: approvedAt,
        expires_at: expiresAt,
        expired_at: null,
        owner_id: ownerId,
      })
      .select("id")
      .single();

    if (insertError) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(insertError.message),
      });
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    const propertyId = property?.id;

    if (propertyId && shortletPersistence.isShortlet) {
      const settingsClient = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
      const { error: settingsError } = await settingsClient.from("shortlet_settings").upsert(
        {
          property_id: propertyId,
          booking_mode: shortletPersistence.bookingMode,
          nightly_price_minor: shortletPersistence.nightlyPriceMinor,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "property_id" }
      );
      if (settingsError) {
        return NextResponse.json(
          { error: settingsError.message || "Unable to save shortlet settings." },
          { status: 500 }
        );
      }
    }

    if (propertyId && imageUrls.length) {
      await supabase.from("property_images").insert(
        imageUrls.map((url, index) => {
          const metaForUrl = imageMeta?.[url] as
            | ({ exif?: { hasGps?: boolean | null; capturedAt?: string | null } } & object)
            | undefined;
          return {
            property_id: propertyId,
            image_url: url,
            position: index,
            ...sanitizeImageMeta(imageMeta?.[url]),
            ...sanitizeExifMeta(metaForUrl?.exif),
          };
        })
      );
    }

    return NextResponse.json({ id: propertyId });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const fieldErrors = mapZodErrorToFieldErrors(error);
      return NextResponse.json(
        { error: "Please correct the highlighted fields.", fieldErrors },
        { status: 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Unable to create property";
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

export async function GET(request: NextRequest) {
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
      { error: "Supabase is not configured; set env vars to fetch properties.", properties: [] },
      { status: 503 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const ownerOnly = scope === "own";
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const page = Number(pageParam || "1");
    const pageSize = Number(pageSizeParam || "12");
    const shouldPaginate = pageParam !== null || pageSizeParam !== null;
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safePageSize =
      Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 48) : 12;

    const missingPosition = (message?: string | null) =>
      typeof message === "string" &&
      message.includes("position") &&
      message.includes("property_images");
    const missingApprovedAt = (message?: string | null) =>
      typeof message === "string" &&
      message.includes("approved_at") &&
      message.includes("properties");

    let viewerRole = null as ReturnType<typeof normalizeRole>;
    let viewerUserId: string | null = null;
    if (!ownerOnly) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        viewerUserId = user?.id ?? null;
        if (viewerUserId) {
          viewerRole = normalizeRole(await getUserRole(supabase, viewerUserId));
        }
      } catch {
        viewerRole = null;
        viewerUserId = null;
      }
    }

    if (ownerOnly) {
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

      const actingAs = readActingAsFromRequest(request);
      let ownerId = auth.user.id;
      if (role === "agent" && actingAs && actingAs !== auth.user.id) {
        const allowed = await hasActiveDelegation(supabase, auth.user.id, actingAs);
        if (!allowed) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        ownerId = actingAs;
      }

      const buildOwnerQuery = (includePosition: boolean) => {
        const baseFields =
          "image_url,id,created_at,width,height,bytes,format,blurhash,storage_path,original_storage_path,thumb_storage_path,card_storage_path,hero_storage_path,exif_has_gps,exif_captured_at";
        const imageFields = includePosition
          ? `position,${baseFields}`
          : baseFields;
        let query = supabase
          .from("properties")
          .select(
            `*, property_images(${imageFields}), property_videos(id, video_url, storage_path, bytes, format, created_at, updated_at), shortlet_settings(property_id,booking_mode,nightly_price_minor)`
          )
          .order("created_at", { ascending: false });
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
        return query;
      };

      if (role !== "admin") {
        const baseQuery = buildOwnerQuery(true).eq("owner_id", ownerId);
        const { data, error } = await baseQuery;
        if (error && missingPosition(error.message)) {
          const fallback = await buildOwnerQuery(false).eq("owner_id", ownerId);
          if (fallback.error) {
            logFailure({
              request,
              route: routeLabel,
              status: 400,
              startTime,
              error: new Error(fallback.error.message),
            });
            return NextResponse.json(
              { error: fallback.error.message, properties: [] },
              { status: 400 }
            );
          }
          const latest = await fetchLatestCheckins(fallback.data?.map((row) => row.id) ?? []);
          const mapped =
            fallback.data?.map((row) => ({
              ...row,
              checkin_signal: buildCheckinSignal(latest.get(row.id) ?? null, {
                flagEnabled: true,
              }),
            })) ?? [];
          return NextResponse.json({ properties: mapped }, { status: 200 });
        }
        if (error) {
          logFailure({
            request,
            route: routeLabel,
            status: 400,
            startTime,
            error: new Error(error.message),
          });
          return NextResponse.json({ error: error.message, properties: [] }, { status: 400 });
        }
        const latest = await fetchLatestCheckins(data?.map((row) => row.id) ?? []);
        const mapped =
          data?.map((row) => ({
            ...row,
            checkin_signal: buildCheckinSignal(latest.get(row.id) ?? null, { flagEnabled: true }),
          })) ?? [];
        return NextResponse.json({ properties: mapped }, { status: 200 });
      }

      const { data, error } = await buildOwnerQuery(true);
      if (error && missingPosition(error.message)) {
        const fallback = await buildOwnerQuery(false);
        if (fallback.error) {
          logFailure({
            request,
            route: routeLabel,
            status: 400,
            startTime,
            error: new Error(fallback.error.message),
          });
          return NextResponse.json(
            { error: fallback.error.message, properties: [] },
            { status: 400 }
          );
        }
        const latest = await fetchLatestCheckins(fallback.data?.map((row) => row.id) ?? []);
        const mapped =
          fallback.data?.map((row) => ({
            ...row,
            checkin_signal: buildCheckinSignal(latest.get(row.id) ?? null, { flagEnabled: true }),
          })) ?? [];
        return NextResponse.json({ properties: mapped }, { status: 200 });
      }

      if (error) {
        logFailure({
          request,
          route: routeLabel,
          status: 400,
          startTime,
          error: new Error(error.message),
        });
        return NextResponse.json({ error: error.message, properties: [] }, { status: 400 });
      }

      const latest = await fetchLatestCheckins(data?.map((row) => row.id) ?? []);
      const mapped =
        data?.map((row) => ({
          ...row,
          checkin_signal: buildCheckinSignal(latest.get(row.id) ?? null, { flagEnabled: true }),
        })) ?? [];
      return NextResponse.json({ properties: mapped }, { status: 200 });
    }

    const nowIso = new Date().toISOString();
    const includeDemoListings = includeDemoListingsForViewer({ viewerRole });
    const missingExpiresAt = (message?: string | null) =>
      typeof message === "string" &&
      message.includes("expires_at") &&
      message.includes("properties");
    const buildPublicQuery = (
      includePosition: boolean,
      cutoff: string | null,
      includeExpiryFilter: boolean = true
    ) => {
      const imageFields = includePosition
        ? "image_url,id,position,created_at,width,height,bytes,format,storage_path,original_storage_path,thumb_storage_path,card_storage_path,hero_storage_path"
        : "image_url,id,created_at,width,height,bytes,format,storage_path,original_storage_path,thumb_storage_path,card_storage_path,hero_storage_path";
      let query = supabase
        .from("properties")
        .select(`*, property_images(${imageFields}), shortlet_settings(property_id,booking_mode,nightly_price_minor)`, {
          count: shouldPaginate ? "exact" : undefined,
        })
        .eq("is_approved", true)
        .eq("is_active", true)
        .eq("status", "live")
        .order("created_at", { ascending: false });
      if (!includeDemoListings) {
        query = query.eq("is_demo", false);
      }
      if (includeExpiryFilter) {
        query = query.or(`expires_at.is.null,expires_at.gte.${nowIso}`);
      }
      if (cutoff) {
        query = query.or(`approved_at.is.null,approved_at.lte.${cutoff}`);
      }
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
      return query;
    };

    if (shouldPaginate) {
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;
      const runQuery = async (includePosition: boolean, cutoff: string | null) => {
        let result = await buildPublicQuery(includePosition, cutoff).range(from, to);
        if (result.error && missingApprovedAt(result.error.message) && cutoff) {
          result = await buildPublicQuery(includePosition, null).range(from, to);
        }
        if (result.error && missingExpiresAt(result.error.message)) {
          result = await buildPublicQuery(includePosition, cutoff, false).range(from, to);
          if (result.error && missingApprovedAt(result.error.message) && cutoff) {
            result = await buildPublicQuery(includePosition, null, false).range(from, to);
          }
        }
        return result;
      };

      const { data, error, count } = await runQuery(true, null);
      if (error && missingPosition(error.message)) {
        const fallback = await runQuery(false, null);
        if (fallback.error) {
          logFailure({
            request,
            route: routeLabel,
            status: 400,
            startTime,
            error: new Error(fallback.error.message),
          });
          return NextResponse.json(
            { error: fallback.error.message, properties: [] },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { properties: fallback.data || [], page: safePage, pageSize: safePageSize, total: fallback.count ?? null },
          { status: 200 }
        );
      }

      if (error) {
        logFailure({
          request,
          route: routeLabel,
          status: 400,
          startTime,
          error: new Error(error.message),
        });
        return NextResponse.json({ error: error.message, properties: [] }, { status: 400 });
      }

      return NextResponse.json(
        { properties: data || [], page: safePage, pageSize: safePageSize, total: count ?? null },
        { status: 200 }
      );
    }
    const runQuery = async (includePosition: boolean, cutoff: string | null) => {
      let result = await buildPublicQuery(includePosition, cutoff);
      if (result.error && missingApprovedAt(result.error.message) && cutoff) {
        result = await buildPublicQuery(includePosition, null);
      }
      if (result.error && missingExpiresAt(result.error.message)) {
        result = await buildPublicQuery(includePosition, cutoff, false);
        if (result.error && missingApprovedAt(result.error.message) && cutoff) {
          result = await buildPublicQuery(includePosition, null, false);
        }
      }
      return result;
    };

    const { data, error, count } = await runQuery(true, null);
    if (error && missingPosition(error.message)) {
      const fallback = await runQuery(false, null);
      if (fallback.error) {
        logFailure({
          request,
          route: routeLabel,
          status: 400,
          startTime,
          error: new Error(fallback.error.message),
        });
        return NextResponse.json(
          { error: fallback.error.message, properties: [] },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { properties: fallback.data || [], page: safePage, pageSize: safePageSize, total: fallback.count ?? null },
        { status: 200 }
      );
    }

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json({ error: error.message, properties: [] }, { status: 400 });
    }

    return NextResponse.json(
      {
        properties: data || [],
        page: shouldPaginate ? safePage : undefined,
        pageSize: shouldPaginate ? safePageSize : undefined,
        total: shouldPaginate ? count ?? null : undefined,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to fetch properties";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: message, properties: [] }, { status: 500 });
  }
}
