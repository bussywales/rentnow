import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateSlotsForDate } from "@/lib/availability/slots";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/availability/slots";

const querySchema = z.object({
  propertyId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

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
      { error: "Supabase is not configured; availability is unavailable." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  let parsed: z.infer<typeof querySchema>;
  try {
    parsed = querySchema.parse({
      propertyId: searchParams.get("propertyId"),
      date: searchParams.get("date"),
    });
  } catch {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, is_approved, is_active, timezone")
    .eq("id", parsed.propertyId)
    .maybeSingle();

  if (propertyError || !property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (!property.is_approved || !property.is_active) {
    return NextResponse.json({ error: "Property is not available" }, { status: 403 });
  }

  const [{ data: rules, error: rulesError }, { data: exceptions, error: exceptionsError }] =
    await Promise.all([
      supabase
        .from("property_availability_rules")
        .select("day_of_week, start_minute, end_minute")
        .eq("property_id", parsed.propertyId),
      supabase
        .from("property_availability_exceptions")
        .select("local_date, exception_type, start_minute, end_minute")
        .eq("property_id", parsed.propertyId)
        .eq("local_date", parsed.date),
    ]);

  if (rulesError || exceptionsError) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(rulesError?.message || exceptionsError?.message || "availability_fetch"),
    });
    return NextResponse.json({ error: "Unable to load availability" }, { status: 400 });
  }

  try {
    const { slots, timeZone } = generateSlotsForDate({
      date: parsed.date,
      timeZone: property.timezone,
      rules: rules || [],
      exceptions: exceptions || [],
    });

    const res = NextResponse.json({
      ok: true,
      timeZone,
      slots: slots.map((slot) => ({
        utc: slot.utc,
        local: slot.local,
      })),
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: err,
    });
    return NextResponse.json(
      { error: "Unable to generate slots for this date" },
      { status: 400 }
    );
  }
}
