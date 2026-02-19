import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  IMAGE_OPTIMISATION_ENABLED,
  PROPERTY_IMAGE_MAX_UPLOAD_BYTES,
  PROPERTY_IMAGE_STORAGE_BUCKET,
} from "@/lib/properties/image-optimisation";
import { processPropertyImageUpload } from "@/lib/properties/image-optimisation.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idParams = z.object({ id: z.string().uuid() });

function buildErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to process image.";
  const status = Number.isFinite((error as { status?: number })?.status)
    ? Number((error as { status?: number }).status)
    : 500;
  const code = (error as { code?: string })?.code ?? "IMAGE_OPTIMISATION_FAILED";
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Storage is not configured.", code: "STORAGE_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  if (!IMAGE_OPTIMISATION_ENABLED) {
    return NextResponse.json(
      { error: "Image optimisation is disabled.", code: "IMAGE_OPTIMISATION_DISABLED" },
      { status: 409 }
    );
  }

  const { id } = idParams.parse(await context.params);
  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: `/api/properties/${id}/images/optimise`,
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

  const { data: propertyRow } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!propertyRow) {
    return NextResponse.json({ error: "Listing not found.", code: "not_found" }, { status: 404 });
  }

  let ownerId = auth.user.id;
  const actingAs = readActingAsFromRequest(request);
  if (role === "agent" && actingAs && actingAs !== auth.user.id) {
    const allowed = await hasActiveDelegation(supabase, auth.user.id, actingAs);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
    }
    ownerId = actingAs;
  }
  if (propertyRow.owner_id !== ownerId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "Image file is required.", code: "IMAGE_REQUIRED" }, { status: 400 });
  }
  if (!fileValue.type.startsWith("image/")) {
    return NextResponse.json({ error: "Unsupported image type.", code: "IMAGE_TYPE_UNSUPPORTED" }, { status: 400 });
  }
  if (fileValue.size <= 0) {
    return NextResponse.json({ error: "Image file is empty.", code: "IMAGE_EMPTY" }, { status: 400 });
  }
  if (fileValue.size > PROPERTY_IMAGE_MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: "Image exceeds 20MB. Please upload a file under 20MB.",
        code: "IMAGE_TOO_LARGE",
      },
      { status: 413 }
    );
  }

  try {
    const adminClient = createServiceRoleClient();
    const adminDb = adminClient as unknown as UntypedAdminClient;
    const storage = adminClient.storage.from(PROPERTY_IMAGE_STORAGE_BUCKET);
    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const imageIdRaw = formData.get("imageId");
    const imageId = typeof imageIdRaw === "string" && imageIdRaw.trim() ? imageIdRaw.trim() : null;

    const result = await processPropertyImageUpload({
      propertyId: id,
      fileBuffer: buffer,
      fileName: fileValue.name,
      contentType: fileValue.type,
      imageId,
      getPublicUrl: (path: string) => storage.getPublicUrl(path).data.publicUrl,
      uploadObject: async ({ path, body, contentType }) => {
        const { error } = await storage.upload(path, body, {
          upsert: true,
          contentType,
        });
        if (error) {
          throw Object.assign(new Error(error.message), {
            code: "IMAGE_STORAGE_UPLOAD_FAILED",
            status: 502,
          });
        }
      },
      getNextPosition: async (propertyId: string) => {
        const { data: currentRows } = await adminDb
          .from("property_images")
          .select("position")
          .eq("property_id", propertyId)
          .order("position", { ascending: false })
          .range(0, 0);
        const latestPosition = (currentRows?.[0] as { position?: number } | undefined)?.position;
        return typeof latestPosition === "number" ? latestPosition + 1 : 0;
      },
      upsertImageRow: async (row) => {
        const { data: savedRow, error } = await adminDb
          .from("property_images")
          .upsert(row, { onConflict: "id" })
          .select(
            "id,image_url,position,width,height,bytes,format,storage_path,original_storage_path,thumb_storage_path,card_storage_path,hero_storage_path"
          )
          .maybeSingle();
        if (error || !savedRow) {
          throw Object.assign(new Error(error?.message || "Unable to persist image metadata."), {
            code: "IMAGE_METADATA_PERSIST_FAILED",
            status: 500,
          });
        }
        const typedSavedRow = savedRow as {
          id: string;
          image_url: string;
          position: number;
          width: number;
          height: number;
          bytes: number;
          format: string | null;
          storage_path: string;
          original_storage_path: string;
          thumb_storage_path: string;
          card_storage_path: string;
          hero_storage_path: string;
        };
        return typedSavedRow;
      },
      findExistingImageRow: async ({ imageId, propertyId }) => {
        const { data } = await adminDb
          .from("property_images")
          .select(
            "id,image_url,position,width,height,bytes,format,storage_path,original_storage_path,thumb_storage_path,card_storage_path,hero_storage_path"
          )
          .eq("id", imageId)
          .eq("property_id", propertyId)
          .maybeSingle();
        return (data as
          | {
              id: string;
              image_url: string;
              position: number;
              width: number;
              height: number;
              bytes: number;
              format: string | null;
              storage_path: string;
              original_storage_path: string;
              thumb_storage_path: string;
              card_storage_path: string;
              hero_storage_path: string;
            }
          | null) ?? null;
      },
    });

    return NextResponse.json({
      ok: true,
      image: result.image,
      derivatives: result.derivatives,
      warning: result.warning,
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
