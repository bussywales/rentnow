import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { upsertListingInCollectionForOwner } from "@/lib/saved-collections.server";

const routeLabel = "/api/saved/collections/[id]/items";

const createItemSchema = z.object({
  listingId: z.string().trim().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Collection id is required." }, { status: 400 });

  try {
    const body = await request.json().catch(() => null);
    const payload = createItemSchema.parse(body || {});
    const result = await upsertListingInCollectionForOwner({
      supabase: auth.supabase,
      ownerUserId: auth.user.id,
      collectionId: id,
      listingId: payload.listingId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "listingId is required." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unable to save listing.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
