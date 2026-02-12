import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { mapUpdateAudiencesToProductAudiences } from "@/lib/product-updates/update-notes";
import { readUpdateNote } from "@/lib/product-updates/update-notes.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/product-updates/import";

const importSchema = z.object({
  filename: z.string().min(1),
});

type ImportPayload = z.infer<typeof importSchema>;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  let payload: ImportPayload;
  try {
    payload = importSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
  const client = adminClient ?? auth.supabase;

  try {
    const { parsed, hash, filename } = await readUpdateNote(payload.filename);
    const audiences = mapUpdateAudiencesToProductAudiences(parsed.audiences);
    if (!audiences.length) {
      return NextResponse.json({ error: "Update note audiences are missing." }, { status: 422 });
    }

    const results: Array<{ audience: string; id: string }> = [];
    for (const audience of audiences) {
      const { data: existing } = await client
        .from("product_updates")
        .select("id, published_at")
        .eq("source_ref", filename)
        .eq("audience", audience)
        .maybeSingle();

      const publishedAt = parsed.published_at ?? existing?.published_at ?? null;

      if (existing?.id) {
        const { data: updated, error } = await client
          .from("product_updates")
          .update({
            title: parsed.title.trim(),
            summary: parsed.summary.trim(),
            body: parsed.body.trim() || null,
            published_at: publishedAt,
            source_ref: filename,
            source_hash: hash,
          })
          .eq("id", existing.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (updated?.id) results.push({ audience, id: updated.id });
      } else {
        const { data: inserted, error } = await client
          .from("product_updates")
          .insert({
            title: parsed.title.trim(),
            summary: parsed.summary.trim(),
            body: parsed.body.trim() || null,
            audience,
            published_at: publishedAt,
            created_by: auth.user.id,
            source_ref: filename,
            source_hash: hash,
          })
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (inserted?.id) results.push({ audience, id: inserted.id });
      }
    }

    return NextResponse.json({ imported: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "import failed";
    const isValidationError =
      typeof message === "string" &&
      (message.startsWith("Invalid update note") || message.includes("ENOENT"));

    logFailure({
      request,
      route: routeLabel,
      status: isValidationError ? 422 : 500,
      startTime,
      error: error instanceof Error ? error.stack || error.message : "import failed",
    });
    if (isValidationError) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: "Unable to import update note." }, { status: 500 });
  }
}
