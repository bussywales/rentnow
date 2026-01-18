import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { coverBelongsToImages } from "@/lib/properties/cover";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase not configured; cannot set cover." },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: `/api/properties/${id}/cover`,
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

  const { data: propertyRow, error: propertyError } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();
  if (propertyError || !propertyRow) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (propertyRow.owner_id !== ownerId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let coverImageUrl: string | null = null;
  try {
    const body = await request.json();
    const raw = body?.coverImageUrl;
    if (raw === null || raw === undefined || raw === "") {
      coverImageUrl = null;
    } else if (typeof raw === "string") {
      coverImageUrl = raw;
    } else {
      return NextResponse.json({ error: "Invalid coverImageUrl." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (coverImageUrl) {
    const { data: images, error: imgError } = await supabase
      .from("property_images")
      .select("image_url")
      .eq("property_id", id);
    if (imgError) {
      return NextResponse.json({ error: imgError.message }, { status: 400 });
    }
    const urls = (images || []).map((row) => row.image_url as string);
    if (!coverBelongsToImages(coverImageUrl, urls)) {
      return NextResponse.json(
        { error: "Cover image must be one of the property photos." },
        { status: 400 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("properties")
    .update({ cover_image_url: coverImageUrl })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, coverImageUrl });
}
