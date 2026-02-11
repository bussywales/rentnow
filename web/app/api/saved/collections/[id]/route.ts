import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import {
  deleteCollectionForOwner,
  listCollectionsForOwner,
  updateCollectionForOwner,
} from "@/lib/saved-collections.server";

const routeLabel = "/api/saved/collections/[id]";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    shareEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

export async function PATCH(
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
    const payload = patchSchema.parse(body || {});

    const updated = await updateCollectionForOwner({
      supabase: auth.supabase,
      ownerUserId: auth.user.id,
      collectionId: id,
      title: payload.title,
      shareEnabled: payload.shareEnabled,
    });

    if (!updated) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }

    const collections = await listCollectionsForOwner({
      supabase: auth.supabase,
      ownerUserId: auth.user.id,
    });
    const collection = collections.find((row) => row.id === id) || null;
    return NextResponse.json({ ok: true, collection, collections });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid collection update payload." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unable to update collection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Collection id is required." }, { status: 400 });

  try {
    const deleted = await deleteCollectionForOwner({
      supabase: auth.supabase,
      ownerUserId: auth.user.id,
      collectionId: id,
    });
    if (!deleted) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete collection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
