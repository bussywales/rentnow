import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import {
  setListingInDefaultCollection,
  toggleListingInDefaultCollection,
} from "@/lib/saved-collections.server";

const routeLabel = "/api/saved/toggle";

const toggleSchema = z.object({
  listingId: z.string().trim().min(1),
  desiredSaved: z.boolean().optional(),
});

export type SavedToggleDeps = {
  requireUser: typeof requireUser;
  toggleListingInDefaultCollection: typeof toggleListingInDefaultCollection;
  setListingInDefaultCollection: typeof setListingInDefaultCollection;
};

const defaultDeps: SavedToggleDeps = {
  requireUser,
  toggleListingInDefaultCollection,
  setListingInDefaultCollection,
};

export async function postSavedToggleResponse(
  request: Request,
  deps: SavedToggleDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const payload = toggleSchema.parse(body || {});

    const result =
      typeof payload.desiredSaved === "boolean"
        ? await deps.setListingInDefaultCollection({
            supabase: auth.supabase,
            ownerUserId: auth.user.id,
            listingId: payload.listingId,
            desiredSaved: payload.desiredSaved,
          })
        : await deps.toggleListingInDefaultCollection({
            supabase: auth.supabase,
            ownerUserId: auth.user.id,
            listingId: payload.listingId,
          });

    // Backward compatibility for legacy readers that still query saved_properties.
    if (result.saved) {
      await auth.supabase.from("saved_properties").upsert({
        user_id: auth.user.id,
        property_id: payload.listingId,
      });
    } else {
      await auth.supabase
        .from("saved_properties")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("property_id", payload.listingId);
    }

    return NextResponse.json({
      ok: true,
      saved: result.saved,
      defaultCollectionId: result.collectionId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "listingId is required." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unable to update saved state.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  return postSavedToggleResponse(request);
}
