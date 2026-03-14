import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getUserRole,
  requireOwnership,
  requireRole,
} from "@/lib/authz";
import {
  createServerSupabaseClient,
  hasServerSupabaseEnv,
} from "@/lib/supabase/server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import {
  logPropertyEvent,
  resolveEventSessionKey,
} from "@/lib/analytics/property-events.server";
import {
  LISTING_QUALITY_TELEMETRY_EVENT_TYPES,
  normalizeListingQualityFixClickTelemetry,
  normalizeListingQualityGuidanceTelemetry,
} from "@/lib/properties/listing-quality-telemetry";
import { logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/properties/[id]/quality-guidance";

const bodySchema = z.object({
  eventType: z.enum(LISTING_QUALITY_TELEMETRY_EVENT_TYPES),
  payload: z.unknown(),
});

type ListingRow = {
  id: string;
  owner_id: string;
};

export type ListingQualityTelemetryRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireRole: typeof requireRole;
  requireOwnership: typeof requireOwnership;
  getUserRole: typeof getUserRole;
  hasActiveDelegation: typeof hasActiveDelegation;
  logPropertyEvent: typeof logPropertyEvent;
  resolveEventSessionKey: typeof resolveEventSessionKey;
  logFailure: typeof logFailure;
};

const defaultDeps: ListingQualityTelemetryRouteDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireRole,
  requireOwnership,
  getUserRole,
  hasActiveDelegation,
  logPropertyEvent,
  resolveEventSessionKey,
  logFailure,
};

export async function postPropertyQualityGuidanceResponse(
  request: NextRequest,
  propertyId: string,
  deps: ListingQualityTelemetryRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
    supabase,
  });
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
  }

  const { data: listing, error: listingError } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId)
    .maybeSingle<ListingRow>();

  if (listingError || !listing) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: listingError || "Listing not found",
    });
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const ownership = deps.requireOwnership({
    request,
    route: routeLabel,
    startTime,
    resourceOwnerId: listing.owner_id,
    userId: auth.user.id,
    role: auth.role,
    allowRoles: ["admin"],
  });
  if (!ownership.ok) {
    if (auth.role === "agent") {
      const ownerRole = await deps.getUserRole(supabase, listing.owner_id);
      const allowed =
        ownerRole === "landlord"
          ? await deps.hasActiveDelegation(supabase, auth.user.id, listing.owner_id)
          : false;
      if (!allowed) return ownership.response;
    } else {
      return ownership.response;
    }
  }

  let meta:
    | {
        source: string;
        best_next_fix_key: string | null;
        score_before: number;
        missing_count_before: number;
      }
    | {
        source: string;
        best_next_fix_key: string | null;
        clicked_fix_key: string;
        target_step: string;
        score_before: number;
        missing_count_before: number;
      };

  if (parsed.data.eventType === "listing_quality_guidance_viewed") {
    const payload = normalizeListingQualityGuidanceTelemetry(parsed.data.payload);
    if (!payload) {
      return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
    }

    meta = {
      source: payload.source,
      best_next_fix_key: payload.bestNextFixKey,
      score_before: payload.scoreBefore,
      missing_count_before: payload.missingCountBefore,
    };
  } else {
    const payload = normalizeListingQualityFixClickTelemetry(parsed.data.payload);
    if (!payload) {
      return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
    }

    meta = {
      source: payload.source,
      best_next_fix_key: payload.bestNextFixKey,
      clicked_fix_key: payload.clickedFixKey,
      target_step: payload.targetStep,
      score_before: payload.scoreBefore,
      missing_count_before: payload.missingCountBefore,
    };
  }

  const result = await deps.logPropertyEvent({
    supabase,
    propertyId,
    eventType: parsed.data.eventType,
    actorUserId: auth.user.id,
    actorRole: auth.role,
    sessionKey: deps.resolveEventSessionKey({ request, userId: auth.user.id }),
    meta,
  });

  if (!result.ok) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: result.error,
    });
    return NextResponse.json({ error: "Unable to record telemetry" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postPropertyQualityGuidanceResponse(request, id);
}
