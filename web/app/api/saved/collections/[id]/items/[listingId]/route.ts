import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { removeListingFromCollectionForOwner } from "@/lib/saved-collections.server";

const routeLabel = "/api/saved/collections/[id]/items/[listingId]";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; listingId: string }> }
) {
  const startTime = Date.now();
  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { id, listingId } = await context.params;
  if (!id || !listingId) {
    return NextResponse.json({ error: "Collection id and listing id are required." }, { status: 400 });
  }

  try {
    const result = await removeListingFromCollectionForOwner({
      supabase: auth.supabase,
      ownerUserId: auth.user.id,
      collectionId: id,
      listingId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove listing.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
