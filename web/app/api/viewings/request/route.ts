import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/viewings/request";

const requestSchema = z.object({
  propertyId: z.string().uuid(),
  preferredTimes: z.array(z.string()).min(1).max(3),
  message: z.string().trim().max(1000).optional().nullable(),
});

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

  let payload: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    payload = requestSchema.parse(json);
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  const supabase = auth.supabase;
  try {
    const preferredTimes = validatePreferredTimes(payload.preferredTimes);

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, is_approved, is_active")
      .eq("id", payload.propertyId)
      .maybeSingle();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (!property.is_approved || !property.is_active) {
      return NextResponse.json(
        { error: "Property is not available for viewings" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("viewing_requests")
      .insert({
        property_id: payload.propertyId,
        tenant_id: auth.user.id,
        preferred_times: preferredTimes,
        message: payload.message ?? null,
      })
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

    return NextResponse.json({
      ok: true,
      viewingRequestId: data.id,
    });
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json(
      { error: "Unable to create viewing request" },
      { status: 500 }
    );
  }
}
