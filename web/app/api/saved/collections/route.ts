import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import {
  createCollectionForOwner,
  ensureDefaultCollection,
  listCollectionsForOwner,
} from "@/lib/saved-collections.server";

const routeLabel = "/api/saved/collections";

const createCollectionSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    let collections = await listCollectionsForOwner({
      supabase: auth.supabase,
      ownerUserId: auth.user.id,
      listingId,
    });

    if (!collections.length) {
      await ensureDefaultCollection({
        supabase: auth.supabase,
        userId: auth.user.id,
      });
      collections = await listCollectionsForOwner({
        supabase: auth.supabase,
        ownerUserId: auth.user.id,
        listingId,
      });
    }

    return NextResponse.json({ ok: true, collections });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load collections.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const payload = createCollectionSchema.parse(body || {});
    const created = await createCollectionForOwner({
      supabase: auth.supabase,
      ownerUserId: auth.user.id,
      title: payload.title,
    });

    const collections = await listCollectionsForOwner({
      supabase: auth.supabase,
      ownerUserId: auth.user.id,
    });
    const createdSummary = collections.find((collection) => collection.id === created.id) || null;
    return NextResponse.json({ ok: true, collection: createdSummary, collections });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create collection.";
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Collection title is required." }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
