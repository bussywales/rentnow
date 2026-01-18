import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireOwnership } from "@/lib/authz";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import { pickRecommendedCover } from "@/lib/properties/recommended-cover";
import { logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const { id } = await params;
  const role = await getUserRole(supabase, user.id);

  const { data: propertyRow, error: propertyError } = await supabase
    .from("properties")
    .select("id, owner_id, cover_image_url")
    .eq("id", id)
    .maybeSingle();

  if (propertyError || !propertyRow) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const ownership = requireOwnership({
    request,
    route: "/api/properties/[id]/cover/recommended",
    startTime,
    userId: user.id,
    resourceOwnerId: propertyRow.owner_id,
    role: normalizeRole(role),
  });
  if (!ownership.ok) {
    return ownership.response;
  }

  const { data, error } = await supabase
    .from("property_images")
    .select("image_url, position, created_at, width, height")
    .eq("property_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logFailure({
      request,
      route: "/api/properties/[id]/cover/recommended",
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data || !data.length) {
    return NextResponse.json({ ok: true, recommended: null });
  }

  const recommended = pickRecommendedCover(data);
  if (!recommended.url) {
    return NextResponse.json({ ok: true, recommended: null });
  }

  const meta = data.find((img) => img.image_url === recommended.url);
  const width = meta?.width ?? null;
  const height = meta?.height ?? null;
  const isPortrait = typeof width === "number" && typeof height === "number" ? height > width : null;
  const meets1600 = typeof width === "number" && typeof height === "number" ? width >= 1600 && height >= 900 : null;

  return NextResponse.json({
    ok: true,
    recommended: {
      url: recommended.url,
      reason: recommended.reason,
      isAlreadyCover: propertyRow.cover_image_url === recommended.url,
      quality: { width, height, meets1600x900: meets1600, isPortrait },
    },
  });
}
