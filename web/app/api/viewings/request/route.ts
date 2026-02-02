import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  assertPreferredTimesInAvailability,
  isoToLocalDate,
  type AvailabilityException,
  type AvailabilityRule,
} from "@/lib/availability/slots";
import { logFailure } from "@/lib/observability";
import {
  CONTACT_EXCHANGE_BLOCK_CODE,
  CONTACT_EXCHANGE_BLOCK_MESSAGE,
  sanitizeMessageContent,
} from "@/lib/messaging/contact-exchange";
import { getContactExchangeMode } from "@/lib/settings/app-settings.server";

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
    const normalizedDate = `${parsed.preferred_date}T12:00:00Z`;
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

export function validatePreferredTimesWithAvailability(
  times: string[],
  timeZone: string,
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[]
): string[] {
  return assertPreferredTimesInAvailability({
    preferredTimes: times,
    timeZone,
    rules,
    exceptions,
  });
}

export function buildViewingInsertPayload(
  payload: ReturnType<typeof parseRequestPayload>,
  tenantId: string,
  propertyTimeZone: string,
  options?: { rules?: AvailabilityRule[]; exceptions?: AvailabilityException[] }
) {
  const preferredTimes = validatePreferredTimesWithAvailability(
    payload.preferredTimes,
    propertyTimeZone,
    options?.rules ?? [],
    options?.exceptions ?? []
  );
  return {
    property_id: payload.propertyId,
    tenant_id: tenantId,
    preferred_times: preferredTimes,
    message: payload.message ?? null,
  };
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
  if (payload.message) {
    const contactMode = await getContactExchangeMode(supabase);
    const sanitized = sanitizeMessageContent(payload.message, contactMode);
    if (sanitized.action === "block") {
      return NextResponse.json(
        { error: CONTACT_EXCHANGE_BLOCK_MESSAGE, code: CONTACT_EXCHANGE_BLOCK_CODE },
        { status: 400 }
      );
    }
    payload = { ...payload, message: sanitized.text };
  }
  try {
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, is_approved, is_active, timezone")
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

    const timeZone = property.timezone || "Africa/Lagos";
    const dates = Array.from(
      new Set(payload.preferredTimes.map((iso) => isoToLocalDate(iso, timeZone)))
    );

    const [{ data: rules, error: rulesError }, { data: exceptions, error: exceptionsError }] =
      await Promise.all([
        supabase
          .from("property_availability_rules")
          .select("day_of_week, start_minute, end_minute")
          .eq("property_id", payload.propertyId),
        supabase
          .from("property_availability_exceptions")
          .select("local_date, exception_type, start_minute, end_minute")
          .eq("property_id", payload.propertyId)
          .in("local_date", dates),
      ]);

    if (rulesError || exceptionsError) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(rulesError?.message || exceptionsError?.message || "availability_fetch"),
      });
      return NextResponse.json(
        { error: "Unable to load availability for this property" },
        { status: 400 }
      );
    }

    const insertPayload = buildViewingInsertPayload(payload, auth.user.id, timeZone, {
      rules: rules ?? [],
      exceptions: exceptions ?? [],
    });

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
