import { NextResponse } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getPublicCollectionByShareId } from "@/lib/saved-collections.server";

const routeLabel = "/api/public/collections/[shareId]";

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await context.params;
  if (!shareId || !isUuid(shareId)) {
    return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  }

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      {
        error: "Collections sharing is unavailable right now.",
        route: routeLabel,
      },
      { status: 503 }
    );
  }

  try {
    const adminClient = createServiceRoleClient();
    const collection = await getPublicCollectionByShareId({
      supabase: adminClient,
      shareId,
    });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, collection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load collection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
