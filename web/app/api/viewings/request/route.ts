import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/viewings/request";

const requestSchema = z.object({
  propertyId: z.string().uuid().optional(),
  preferredTimes: z.array(z.string()).optional(),
  message: z.string().trim().max(1000).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  property_id: z.string().uuid().optional(),
  preferred_date: z.string().optional(),
  preferred_time_window: z.string().optional(),
});

export function parseRequestPayload(body: unknown) {
  const parsed = requestSchema.parse(body);
  const propertyId = parsed.propertyId ?? parsed.property_id;
  if (!propertyId) {
    throw new Error("Invalid property id");
  }

  let preferredTimes = parsed.preferredTimes;
  if ((!preferredTimes || preferredTimes.length === 0) && parsed.preferred_date) {
    const normalizedDate = `${parsed.preferred_date}T12:00:00`;
    preferredTimes = [normalizedDate];
  }
  if (!preferredTimes || preferredTimes.length === 0) {
    throw new Error("Preferred times must include 1 to 3 entries");
  }

  const timeWindow = parsed.preferred_time_window?.trim();
  const baseMessage = parsed.message ?? parsed.note ?? null;
  const message =
    timeWindow && timeWindow.length > 0
      ? [baseMessage, `Preferred window: ${timeWindow}`].filter(Boolean).join(" - ")
      : baseMessage;

  return {
    propertyId,
    preferredTimes,
    message: message ?? null,
  };
}

export function buildViewingInsertPayload(
  payload: ReturnType<typeof parseRequestPayload>,
  tenantId: string
) {
  const preferredTimes = validatePreferredTimes(payload.preferredTimes);
  return {
    property_id: payload.propertyId,
    tenant_id: tenantId,
    preferred_times: preferredTimes,
    message: payload.message ?? null,
  };
}

export function validatePreferredTimes(times: string[]): string[] {
  const parsed = times.map((time) => {
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid preferred time");
    }
    return date.toISOString();
  });
  if (parsed.length < 1 || parsed.length > 3) {
    throw new Error("Preferred times must include 1 to 3 entries");
  }
  return parsed;
}

async function handleViewingRequest(request: Request, handlerLabel: "request" | "legacy-alias") {
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
      { error: "Supabase is not configured; viewing requests are unavailable." },
      { status: 503 }
    );
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant"],
  });
  if (!auth.ok) return auth.response;

  let payload: ReturnType<typeof parseRequestPayload>;
  let receivedKeys: string[] | undefined;
  try {
    const body = await request.json();
    if (process.env.NODE_ENV !== "production" && body && typeof body === "object") {
      receivedKeys = Object.keys(body as Record<string, unknown>).sort();
    }
    payload = parseRequestPayload(body);
  } catch {
    const res = NextResponse.json({ error: "Invalid request" }, { status: 400 });
    res.headers.set("x-viewings-handler", handlerLabel);
    return res;
  }

  const supabase = auth.supabase;
  try {
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, is_approved, is_active")
      .eq("id", payload.propertyId)
      .maybeSingle();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (!property.is_approved || !property.is_active) {
      const res = NextResponse.json(
        { error: "Property is not available for viewings" },
        { status: 403 }
      );
      res.headers.set("x-viewings-handler", handlerLabel);
      return res;
    }

    const insertPayload = buildViewingInsertPayload(payload, auth.user.id);

    const { data, error } = await supabase
      .from("viewing_requests")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json(
        { error: "Unable to create viewing request" },
        { status: 400 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      viewingRequestId: data.id,
      ...(process.env.NODE_ENV !== "production" && receivedKeys
        ? { receivedKeys }
        : {}),
    });
    res.headers.set("x-viewings-handler", handlerLabel);
    return res;
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    const res = NextResponse.json(
      { error: "Unable to create viewing request" },
      { status: 500 }
    );
    res.headers.set("x-viewings-handler", handlerLabel);
    return res;
  }
}

export async function POST(request: Request) {
  return handleViewingRequest(request, "request");
}

export { handleViewingRequest };
