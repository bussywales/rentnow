import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import {
  PRODUCT_UPDATE_AUDIENCES,
  type ProductUpdateAudience,
} from "@/lib/product-updates/constants";
import { isProductUpdateAudience } from "@/lib/product-updates/audience";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/product-updates";

const createSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(240),
  audience: z.enum(PRODUCT_UPDATE_AUDIENCES).optional(),
  image_url: z.string().url().nullable().optional(),
  body: z.string().max(5000).nullable().optional(),
});

type UpdatePayload = z.infer<typeof createSchema>;

function normalizeImageUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
  const client = adminClient ?? auth.supabase;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const audienceParam = url.searchParams.get("audience");
  const safeAudience: ProductUpdateAudience | null =
    isProductUpdateAudience(audienceParam) ? audienceParam : null;

  try {
    let query = client
      .from("product_updates")
      .select(
        "id,title,summary,body,image_url,audience,published_at,created_at,updated_at,created_by"
      )
      .order("updated_at", { ascending: false });

    if (status === "draft") {
      query = query.is("published_at", null);
    } else if (status === "published") {
      query = query.not("published_at", "is", null);
    }

    if (safeAudience) {
      query = query.eq("audience", safeAudience);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ updates: data ?? [] });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error instanceof Error ? error.message : "admin updates query failed",
    });
    return NextResponse.json({ error: "Unable to load product updates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  let payload: UpdatePayload;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
  const client = adminClient ?? auth.supabase;

  const audience = payload.audience ?? "all";

  const { data, error } = await client
    .from("product_updates")
    .insert({
      title: payload.title.trim(),
      summary: payload.summary.trim(),
      body: payload.body ?? null,
      image_url: normalizeImageUrl(payload.image_url),
      audience,
      created_by: auth.user.id,
    })
    .select(
      "id,title,summary,body,image_url,audience,published_at,created_at,updated_at,created_by"
    )
    .maybeSingle();

  if (error || !data) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: error || "Unable to create product update",
    });
    return NextResponse.json({ error: "Unable to create update" }, { status: 400 });
  }

  return NextResponse.json({ update: data });
}
