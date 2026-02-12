import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { importSharedCollectionForOwner } from "@/lib/saved-collections.server";

const routeLabel = "/api/saved/collections/import";

const schema = z.object({
  shareId: z.string().uuid(),
});

export type ImportSharedCollectionDeps = {
  requireUser: typeof requireUser;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  importSharedCollectionForOwner: typeof importSharedCollectionForOwner;
};

const defaultDeps: ImportSharedCollectionDeps = {
  requireUser,
  hasServiceRoleEnv,
  createServiceRoleClient,
  importSharedCollectionForOwner,
};

export async function postSavedCollectionImportResponse(
  request: Request,
  deps: ImportSharedCollectionDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Shared shortlist import is unavailable right now." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const payload = schema.parse(body || {});

    const imported = await deps.importSharedCollectionForOwner({
      ownerSupabase: auth.supabase,
      publicSupabase: deps.createServiceRoleClient(),
      ownerUserId: auth.user.id,
      shareId: payload.shareId,
    });

    return NextResponse.json({
      ok: true,
      collectionId: imported.collectionId,
      collection: imported.collection,
      importedListingCount: imported.importedListingIds.length,
      shareTitle: imported.shareTitle,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "shareId must be a valid UUID." }, { status: 422 });
    }

    const message = error instanceof Error ? error.message : "Unable to import shortlist.";
    if (message.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: "Shared collection not found." }, { status: 404 });
    }
    if (message.toLowerCase().includes("publicly visible")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  return postSavedCollectionImportResponse(request);
}
