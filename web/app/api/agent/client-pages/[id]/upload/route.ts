import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  CLIENT_PAGES_BUCKET,
  buildClientPageImagePath,
  extensionForClientPageImage,
  isAllowedClientPageImageSize,
  isAllowedClientPageImageType,
} from "@/lib/agents/client-pages-storage";
import { safeTrim } from "@/lib/agents/agent-storefront";

export const dynamic = "force-dynamic";

const routeLabel = "/api/agent/client-pages/[id]/upload";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return NextResponse.json(
      {
        error:
          "Client page storage isn't configured yet. Ask an admin to create the 'agent-client-pages' bucket in Supabase Storage.",
        code: "STORAGE_BUCKET_NOT_FOUND",
      },
      { status: 503 }
    );
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const pageId = safeTrim(resolvedParams?.id);
  if (!pageId) {
    return NextResponse.json({ error: "Missing client page id." }, { status: 400 });
  }

  const typeParam = safeTrim(request.nextUrl.searchParams.get("type"));
  const assetType = typeParam === "logo" ? "logo" : "banner";

  const { data: page } = await auth.supabase
    .from("agent_client_pages")
    .select("id, agent_user_id")
    .eq("id", pageId)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: "Client page not found." }, { status: 404 });
  }
  if (page.agent_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const contentType = "type" in file ? file.type : "";
  const size = "size" in file ? file.size : 0;

  if (!isAllowedClientPageImageType(contentType)) {
    return NextResponse.json({ error: "Upload a PNG, JPG, or WebP." }, { status: 400 });
  }

  if (!isAllowedClientPageImageSize(size)) {
    return NextResponse.json({ error: "Image must be 5MB or less." }, { status: 400 });
  }

  const ext = extensionForClientPageImage(contentType);
  const filename = `${randomUUID()}.${ext}`;
  const path = buildClientPageImagePath(auth.user.id, pageId, assetType, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  const adminClient = createServiceRoleClient();
  const upload = await adminClient.storage.from(CLIENT_PAGES_BUCKET).upload(path, buffer, {
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
          ? "Client pages storage isn't configured yet. Ask an admin to create the 'agent-client-pages' bucket in Supabase Storage."
          : message,
        code: bucketMissing ? "STORAGE_BUCKET_NOT_FOUND" : "upload_failed",
      },
      { status: 400 }
    );
  }

  const publicUrl = adminClient.storage.from(CLIENT_PAGES_BUCKET).getPublicUrl(path);
  const imageUrl = publicUrl.data.publicUrl;

  const updatePayload = assetType === "logo" ? { agent_logo_url: imageUrl } : { banner_url: imageUrl };
  await adminClient.from("agent_client_pages").update(updatePayload).eq("id", pageId);

  return NextResponse.json({ imageUrl, path, bucket: CLIENT_PAGES_BUCKET });
}
