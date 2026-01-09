import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { getEarlyAccessApprovedBefore } from "@/lib/early-access";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { getTenantPlanForTier } from "@/lib/plans";
import { getListingAccessResult } from "@/lib/role-access";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure, logPlanLimitHit } from "@/lib/observability";

const routeLabel = "/api/properties";
const EARLY_ACCESS_MINUTES = getTenantPlanForTier("tenant_pro").earlyAccessMinutes;

const propertySchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  city: z.string().min(2),
  neighbourhood: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  rental_type: z.enum(["short_let", "long_term"]),
  price: z.number().nonnegative(),
  currency: z.string().min(2),
  rent_period: z.enum(["monthly", "yearly"]).optional(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  furnished: z.boolean(),
  amenities: z.array(z.string()).optional().nullable(),
  available_from: z.string().optional().nullable(),
  max_guests: z.number().int().nullable().optional(),
  bills_included: z.boolean().optional(),
  epc_rating: z.string().optional().nullable(),
  council_tax_band: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  status: z.enum(["draft", "pending", "live", "rejected", "paused"]).optional(),
  is_active: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
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
    const { imageUrls = [], status, ...rest } = data;
    const isAdmin = role === "admin";
    const normalizedStatus = isAdmin && status ? status : "draft";
    const isActive = normalizedStatus === "pending" || normalizedStatus === "live";
    const isApproved = normalizedStatus === "live";
    const submittedAt = normalizedStatus === "pending" ? new Date().toISOString() : null;
    const approvedAt = normalizedStatus === "live" ? new Date().toISOString() : null;

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
        ...rest,
        amenities: rest.amenities ?? [],
        features: rest.features ?? [],
        status: normalizedStatus,
        is_active: isActive,
        is_approved: isApproved,
        submitted_at: submittedAt,
        approved_at: approvedAt,
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

    if (propertyId && imageUrls.length) {
      await supabase.from("property_images").insert(
        imageUrls.map((url, index) => ({
          property_id: propertyId,
          image_url: url,
          position: index,
        }))
      );
    }

    return NextResponse.json({ id: propertyId });
  } catch (error: unknown) {
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

    let approvedBefore: string | null = null;
    if (!ownerOnly && EARLY_ACCESS_MINUTES > 0) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        let role: string | null = null;
        let planTier: string | null = null;
        let validUntil: string | null = null;
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          role = profile?.role ?? null;
          if (role === "tenant") {
            const { data: planRow } = await supabase
              .from("profile_plans")
              .select("plan_tier, valid_until")
              .eq("profile_id", user.id)
              .maybeSingle();
            planTier = planRow?.plan_tier ?? null;
            validUntil = planRow?.valid_until ?? null;
          }
        }
        ({ approvedBefore } = getEarlyAccessApprovedBefore({
          role,
          hasUser: !!user,
          planTier,
          validUntil,
          earlyAccessMinutes: EARLY_ACCESS_MINUTES,
        }));
      } catch {
        ({ approvedBefore } = getEarlyAccessApprovedBefore({
          role: null,
          hasUser: false,
          planTier: null,
          validUntil: null,
          earlyAccessMinutes: EARLY_ACCESS_MINUTES,
        }));
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
        const imageFields = includePosition
          ? "image_url,id,position,created_at"
          : "image_url,id,created_at";
        let query = supabase
          .from("properties")
          .select(`*, property_images(${imageFields})`)
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
          return NextResponse.json({ properties: fallback.data || [] }, { status: 200 });
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
        return NextResponse.json({ properties: data || [] }, { status: 200 });
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
        return NextResponse.json({ properties: fallback.data || [] }, { status: 200 });
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

      return NextResponse.json({ properties: data || [] }, { status: 200 });
    }

    const buildPublicQuery = (includePosition: boolean, cutoff: string | null) => {
      const imageFields = includePosition
        ? "image_url,id,position,created_at"
        : "image_url,id,created_at";
      let query = supabase
        .from("properties")
        .select(`*, property_images(${imageFields})`, {
          count: shouldPaginate ? "exact" : undefined,
        })
        .eq("is_approved", true)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
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
        const result = await buildPublicQuery(includePosition, cutoff).range(from, to);
        if (result.error && missingApprovedAt(result.error.message) && cutoff) {
          return buildPublicQuery(includePosition, null).range(from, to);
        }
        return result;
      };

      const { data, error, count } = await runQuery(true, approvedBefore);
      if (error && missingPosition(error.message)) {
        const fallback = await runQuery(false, approvedBefore);
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
      const result = await buildPublicQuery(includePosition, cutoff);
      if (result.error && missingApprovedAt(result.error.message) && cutoff) {
        return buildPublicQuery(includePosition, null);
      }
      return result;
    };

    const { data, error, count } = await runQuery(true, approvedBefore);
    if (error && missingPosition(error.message)) {
      const fallback = await runQuery(false, approvedBefore);
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
