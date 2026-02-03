import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  PROPERTY_EVENT_TYPES,
  buildPropertyEventSummary,
  type PropertyEventRow,
  type PropertyEventType,
} from "@/lib/analytics/property-events";
import { getSessionKeyFromRequest, getSessionKeyFromUser } from "@/lib/analytics/session.server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null) {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

export function resolveEventSessionKey({
  request,
  userId,
}: {
  request?: Request;
  userId?: string | null;
}) {
  if (request) {
    const fromRequest = getSessionKeyFromRequest(request);
    if (fromRequest) return fromRequest;
  }
  return getSessionKeyFromUser(userId ?? null);
}

export async function logPropertyEvent({
  supabase,
  propertyId,
  eventType,
  actorUserId,
  actorRole,
  sessionKey,
  meta,
}: {
  supabase: SupabaseClient;
  propertyId: string;
  eventType: PropertyEventType;
  actorUserId?: string | null;
  actorRole?: string | null;
  sessionKey?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  if (!isUuid(propertyId)) return { ok: false, error: "invalid_property" };
  if (!PROPERTY_EVENT_TYPES.includes(eventType)) {
    return { ok: false, error: "invalid_event" };
  }

  const { error, data } = await supabase.rpc("insert_property_event", {
    in_property_id: propertyId,
    in_event_type: eventType,
    in_actor_user_id: actorUserId ?? null,
    in_actor_role: actorRole ?? null,
    in_session_key: sessionKey ?? null,
    in_meta: meta ?? {},
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

export async function logPropertyEventsBulk({
  supabase,
  propertyIds,
  eventType,
  actorUserId,
  actorRole,
  sessionKey,
  meta,
}: {
  supabase: SupabaseClient;
  propertyIds: string[];
  eventType: PropertyEventType;
  actorUserId?: string | null;
  actorRole?: string | null;
  sessionKey?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  const results: Array<{ propertyId: string; ok: boolean }> = [];
  for (const propertyId of propertyIds) {
    const result = await logPropertyEvent({
      supabase,
      propertyId,
      eventType,
      actorUserId,
      actorRole,
      sessionKey,
      meta,
    });
    results.push({ propertyId, ok: result.ok });
  }
  return results;
}

export async function fetchPropertyEvents({
  propertyIds,
  sinceDays = 60,
  client,
}: {
  propertyIds: string[];
  sinceDays?: number;
  client?: SupabaseClient;
}): Promise<{ rows: PropertyEventRow[]; error?: string | null }> {
  if (!propertyIds.length) return { rows: [] };
  const supabase = client
    ? client
    : hasServiceRoleEnv()
      ? createServiceRoleClient()
      : await createServerSupabaseClient();

  const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("property_events")
    .select("property_id,event_type,actor_user_id,session_key,occurred_at,meta")
    .in("property_id", propertyIds)
    .in("event_type", [...PROPERTY_EVENT_TYPES])
    .gte("occurred_at", sinceIso);

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data as PropertyEventRow[]) ?? [] };
}

export function groupEventsByProperty(rows: PropertyEventRow[]) {
  const grouped = new Map<string, PropertyEventRow[]>();
  for (const row of rows) {
    if (!row.property_id) continue;
    if (!grouped.has(row.property_id)) {
      grouped.set(row.property_id, []);
    }
    grouped.get(row.property_id)!.push(row);
  }
  return grouped;
}

export function filterRowsSince(rows: PropertyEventRow[], sinceIso: string, endIso?: string) {
  const start = Date.parse(sinceIso);
  const end = endIso ? Date.parse(endIso) : null;
  return rows.filter((row) => {
    if (!row.occurred_at) return false;
    const ts = Date.parse(row.occurred_at);
    if (Number.isNaN(ts)) return false;
    if (Number.isFinite(start) && ts < start) return false;
    if (end !== null && Number.isFinite(end) && ts > end) return false;
    return true;
  });
}

export function buildSummaryByProperty(rows: PropertyEventRow[]) {
  return buildPropertyEventSummary(rows);
}
