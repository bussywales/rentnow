import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { geocodeMapbox } from "@/lib/geocode/mapbox";
import { parseMapboxFeature } from "@/lib/geocode/parse";
import { sanitizeLabel } from "@/lib/geocode/mapbox";

const routeLabel = "/api/geocode";
const querySchema = z.object({
  q: z.string().min(2),
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
  const parsed = querySchema.safeParse({ q: searchParams.get("q") });
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
    const raw = await geocodeMapbox(parsed.data.q, token);
    const structured = raw.map((item) => {
      const parsed = parseMapboxFeature(item.raw as Record<string, unknown>, sanitizeLabel(item.label));
      if (parsed) return parsed;
      return item;
    });
    return NextResponse.json(structured);
  } catch (err) {
    console.warn("[geocode] error", err);
    return NextResponse.json({ error: "Unable to geocode" }, { status: 500 });
  }
}
