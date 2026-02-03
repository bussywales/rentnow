import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import {
  PRODUCT_UPDATES_BUCKET,
  buildProductUpdateImagePath,
  extensionForProductUpdateImage,
  isAllowedProductUpdateImageSize,
  isAllowedProductUpdateImageType,
} from "@/lib/product-updates/storage";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/product-updates/upload";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return NextResponse.json(
      {
        error:
          "Product updates storage isn't configured yet. Ask an admin to create the 'product-updates' bucket in Supabase Storage.",
        code: "STORAGE_BUCKET_NOT_FOUND",
      },
      { status: 503 }
    );
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const contentType = "type" in file ? file.type : "";
  const size = "size" in file ? file.size : 0;

  if (!isAllowedProductUpdateImageType(contentType)) {
    return NextResponse.json({ error: "Upload a PNG, JPG, or WebP." }, { status: 400 });
  }

  if (!isAllowedProductUpdateImageSize(size)) {
    return NextResponse.json({ error: "Image must be 5MB or less." }, { status: 400 });
  }

  const ext = extensionForProductUpdateImage(contentType);
  const filename = `${randomUUID()}.${ext}`;
  const path = buildProductUpdateImagePath(filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  const adminClient = createServiceRoleClient();
  const upload = await adminClient.storage
    .from(PRODUCT_UPDATES_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

  if (upload.error) {
    const message = upload.error.message || "Unable to upload image.";
    const bucketMissing = message.toLowerCase().includes("bucket") && message.toLowerCase().includes("not found");
    return NextResponse.json(
      {
        error: bucketMissing
          ? "Product updates storage isn't configured yet. Ask an admin to create the 'product-updates' bucket in Supabase Storage."
          : message,
        code: bucketMissing ? "STORAGE_BUCKET_NOT_FOUND" : "upload_failed",
      },
      { status: 400 }
    );
  }

  const publicUrl = adminClient.storage.from(PRODUCT_UPDATES_BUCKET).getPublicUrl(path);

  return NextResponse.json({
    imageUrl: publicUrl.data.publicUrl,
    path,
    bucket: PRODUCT_UPDATES_BUCKET,
  });
}
