import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { geocodeMapbox } from "@/lib/geocode/mapbox";
import { parseMapboxFeature } from "@/lib/geocode/parse";
import { sanitizeLabel } from "@/lib/geocode/mapbox";
import { normalizeMapboxFeature, type MapboxFeature } from "@/lib/geocode/normalize-location";

const routeLabel = "/api/geocode";
const querySchema = z.object({
  q: z.string().min(2),
  country_code: z.string().optional(),
  pin_lat: z.coerce.number().optional(),
  pin_lng: z.coerce.number().optional(),
});

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin", "agent", "landlord"],
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: searchParams.get("q"),
    country_code: searchParams.get("country_code") ?? undefined,
    pin_lat: searchParams.get("pin_lat") ?? undefined,
    pin_lng: searchParams.get("pin_lng") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, code: "MAPBOX_NOT_CONFIGURED", message: "MAPBOX_TOKEN missing" },
      { status: 501 }
    );
  }

  try {
    const raw = await geocodeMapbox(parsed.data.q, token, {
      countryCode: parsed.data.country_code || undefined,
      proximity:
        Number.isFinite(parsed.data.pin_lat) && Number.isFinite(parsed.data.pin_lng)
          ? { latitude: parsed.data.pin_lat as number, longitude: parsed.data.pin_lng as number }
          : undefined,
    });
    const structured = raw.map((item) => {
      const rawFeature = item.raw as MapboxFeature;
      const normalized = normalizeMapboxFeature(rawFeature);
      const parsed = parseMapboxFeature(rawFeature as Record<string, unknown>, sanitizeLabel(item.label));
      if (parsed) {
        return {
          ...parsed,
          admin_area_1: normalized.admin_area_1,
          admin_area_2: normalized.admin_area_2,
          postal_code: normalized.postal_code,
          locality: normalized.locality,
          sublocality: normalized.sublocality,
        };
      }
      return {
        label: sanitizeLabel(item.label),
        place_id: normalized.place_id || item.place_id,
        lat: rawFeature?.center?.[1] ?? null,
        lng: rawFeature?.center?.[0] ?? null,
        admin_area_1: normalized.admin_area_1,
        admin_area_2: normalized.admin_area_2,
        postal_code: normalized.postal_code,
        locality: normalized.locality,
        sublocality: normalized.sublocality,
        country_code: normalized.country_code,
      };
    });
    return NextResponse.json(structured);
  } catch (err) {
    console.warn("[geocode] error", err);
    return NextResponse.json({ error: "Unable to geocode" }, { status: 500 });
  }
}
