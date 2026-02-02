import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { logAuditEvent } from "@/lib/audit/audit-log";
import { assertPreferredTimesInAvailability } from "@/lib/availability/slots";
import {
  CONTACT_EXCHANGE_BLOCK_CODE,
  CONTACT_EXCHANGE_BLOCK_MESSAGE,
  sanitizeMessageContent,
} from "@/lib/messaging/contact-exchange";
import { getContactExchangeMode } from "@/lib/settings/app-settings.server";

const routeLabel = "/api/viewings/respond";

const requestSchema = z.object({
  viewingRequestId: z.string().uuid(),
  action: z.enum(["approve", "propose", "decline"]),
  approvedTime: z.string().optional(),
  proposedTimes: z.array(z.string()).optional(),
  declineReasonCode: z.string().optional(),
  hostMessage: z.string().max(1000).optional().nullable(),
});

export async function PATCH(request: Request) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  let hostMessage = body.hostMessage ?? null;
  if (hostMessage) {
    const contactMode = await getContactExchangeMode(supabase);
    const sanitized = sanitizeMessageContent(hostMessage, contactMode);
    if (sanitized.action === "block") {
      return NextResponse.json(
        { error: CONTACT_EXCHANGE_BLOCK_MESSAGE, code: CONTACT_EXCHANGE_BLOCK_CODE },
        { status: 400 }
      );
    }
    hostMessage = sanitized.text;
  }
  const { data: reqRow, error: reqError } = await supabase
    .from("viewing_requests")
    .select(
      "id, property_id, tenant_id, status, preferred_times, approved_time, proposed_times, decline_reason_code, message, properties:properties!inner(id, owner_id, timezone)"
    )
    .eq("id", body.viewingRequestId)
    .maybeSingle();

  if (reqError || !reqRow) {
    return NextResponse.json({ error: "Viewing request not found" }, { status: 404 });
  }

  const ownerId = (reqRow as { properties?: { owner_id?: string | null } }).properties?.owner_id as
    | string
    | undefined;
  if (ownerId !== auth.user.id && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timeZone =
    (reqRow as { properties?: { timezone?: string | null } }).properties?.timezone || "Africa/Lagos";

  // Fetch availability for proposed/approved dates
  const supa = supabase;
  const datesNeeded = new Set<string>();
  const collectDates = (arr?: string[]) => {
    (arr || []).forEach((iso) => {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(d);
        const dateStr = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
        datesNeeded.add(dateStr);
      }
    });
  };

  if (body.action === "approve") {
    if (!body.approvedTime) {
      return NextResponse.json({ error: "approvedTime is required" }, { status: 400 });
    }
    collectDates([body.approvedTime]);
  }
  if (body.action === "propose") {
    if (!body.proposedTimes || body.proposedTimes.length === 0) {
      return NextResponse.json({ error: "proposedTimes are required" }, { status: 400 });
    }
    collectDates(body.proposedTimes);
  }

  const [rulesRes, exceptionsRes] = await Promise.all([
    supa
      .from("property_availability_rules")
      .select("day_of_week, start_minute, end_minute")
      .eq("property_id", reqRow.property_id),
    supa
      .from("property_availability_exceptions")
      .select("local_date, exception_type, start_minute, end_minute")
      .eq("property_id", reqRow.property_id)
      .in("local_date", Array.from(datesNeeded)),
  ]);

  const rules = rulesRes.data || [];
  const exceptions = exceptionsRes.data || [];

  try {
    if (body.action === "approve") {
      if (!reqRow.preferred_times?.includes(body.approvedTime!)) {
        throw new Error("Approved time must match tenant preference");
      }
      await supa
        .from("viewing_requests")
        .update({
          status: "approved",
          approved_time: body.approvedTime,
          proposed_times: null,
          decline_reason_code: null,
          host_message: hostMessage,
          decided_at: new Date().toISOString(),
        })
        .eq("id", reqRow.id);
    } else if (body.action === "propose") {
      const times = body.proposedTimes || [];
      assertPreferredTimesInAvailability({
        preferredTimes: times,
        timeZone,
        rules,
        exceptions,
      });
      await supa
        .from("viewing_requests")
        .update({
          status: "proposed",
          proposed_times: times,
          approved_time: null,
          decline_reason_code: null,
          host_message: hostMessage,
          decided_at: new Date().toISOString(),
        })
        .eq("id", reqRow.id);
    } else if (body.action === "decline") {
      if (!body.declineReasonCode) {
        return NextResponse.json({ error: "declineReasonCode is required" }, { status: 400 });
      }
      await supa
        .from("viewing_requests")
        .update({
          status: "declined",
          decline_reason_code: body.declineReasonCode,
          approved_time: null,
          proposed_times: null,
          host_message: hostMessage,
          decided_at: new Date().toISOString(),
        })
        .eq("id", reqRow.id);
    }
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: err,
    });
    return NextResponse.json({ error: "Unable to update request" }, { status: 400 });
  }

  logAuditEvent("viewings.host.respond", {
    route: routeLabel,
    actorId: auth.user.id,
    propertyId: reqRow.property_id,
    outcome: "ok",
    meta: { action: body.action },
  });

  return NextResponse.json({ ok: true });
}
