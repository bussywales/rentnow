import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { buildOrderedImages, mediaOrderError } from "@/lib/properties/order";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase not configured; cannot update media order." },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();

  const auth = await requireUser({
    request,
    route: `/api/properties/${id}/media-order`,
    startTime: Date.now(),
    supabase,
  });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: "Please log in to manage listings.", code: "not_authenticated" },
      { status: 401 }
    );
  }

  const role = await getUserRole(supabase, auth.user.id);
  const access = getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: access.status });
  }

  let ownerId = auth.user.id;
  if (role === "agent") {
    const actingAs = readActingAsFromRequest(request);
    if (actingAs && actingAs !== auth.user.id) {
      const allowed = await hasActiveDelegation(supabase, auth.user.id, actingAs);
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      ownerId = actingAs;
    }
  }

  const body = await request.json().catch(() => ({}));
  const order = Array.isArray(body?.order) ? (body.order as string[]) : null;
  if (!order) {
    return mediaOrderError("Provide an order array of image URLs.");
  }

  const { data: images, error: fetchError } = await supabase
    .from("property_images")
    .select("id, image_url, properties!inner(owner_id)")
    .eq("property_id", id);

  if (fetchError) {
    return mediaOrderError(fetchError.message);
  }
  const rows =
    images?.map((img) => ({
      id: img.id as string,
      image_url: (img.image_url as string) ?? "",
      owner_id: (img as unknown as { properties: { owner_id: string } }).properties.owner_id,
    })) ?? [];

  if (rows.length === 0) {
    return mediaOrderError("No images found for this property.");
  }
  const ownerMismatch = rows.some((row) => row.owner_id !== ownerId);
  if (ownerMismatch && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let updates;
  let ordered;
  try {
    const result = buildOrderedImages(
      rows.map((r) => ({ id: r.id, image_url: r.image_url })),
      order
    );
    updates = result.updates;
    ordered = result.ordered;
  } catch (err) {
    return mediaOrderError(err instanceof Error ? err.message : "Invalid order.");
  }

  const { error: updateError } = await supabase.from("property_images").upsert(
    updates.map((u) => ({
      id: u.id,
      position: u.position,
    }))
  );
  if (updateError) {
    return mediaOrderError(updateError.message);
  }

  return NextResponse.json({
    ok: true,
    images: ordered.map((img, idx) => ({ ...img, position: idx })),
  });
}
