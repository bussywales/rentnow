import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getFileHelpDocByRoleAndSlug } from "@/lib/help/docs";
import {
  HELP_TUTORIAL_STATUSES,
  HELP_TUTORIAL_VISIBILITIES,
  HELP_TUTORIAL_AUDIENCES,
  extractYouTubeId,
  isValidTutorialVisibilityForAudience,
  normalizeTutorialSlug,
  type HelpTutorialAudience,
  type HelpTutorialRecord,
} from "@/lib/help/tutorials";
import {
  buildTutorialMutation,
  type AdminHelpTutorialRouteDeps,
} from "@/app/api/admin/help/tutorials/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type TutorialSlugCollisionResult = { data: Array<{ id: string }> | null };

type TutorialQueryClient = {
  from: (table: string) => TutorialQueryBuilder;
};

type TutorialQueryBuilder = PromiseLike<TutorialSlugCollisionResult> & {
  select: (columns: string) => TutorialQueryBuilder;
  eq: (column: string, value: string) => TutorialQueryBuilder;
  limit: (count: number) => TutorialQueryBuilder;
};

type AdminHelpTutorialPatchRouteDeps = Pick<
  AdminHelpTutorialRouteDeps,
  "hasServerSupabaseEnv" | "requireRole" | "getFileHelpDocByRoleAndSlug"
>;

const defaultDeps: AdminHelpTutorialPatchRouteDeps = {
  hasServerSupabaseEnv,
  requireRole,
  getFileHelpDocByRoleAndSlug,
};

const updateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(10).max(280),
  seo_title: z.string().trim().max(160).nullable().optional(),
  meta_description: z.string().trim().max(280).nullable().optional(),
  audience: z.enum(HELP_TUTORIAL_AUDIENCES),
  visibility: z.enum(HELP_TUTORIAL_VISIBILITIES),
  status: z.enum(HELP_TUTORIAL_STATUSES),
  video_url: z.string().trim().max(240).nullable().optional(),
  body: z.string().trim().min(20).max(20000),
});

async function ensureNoTutorialSlugCollision(input: {
  supabase: unknown;
  audience: HelpTutorialAudience;
  slug: string;
  ignoreId?: string;
}) {
  const { data } = await (input.supabase as TutorialQueryClient)
    .from("help_tutorials")
    .select("id")
    .eq("audience", input.audience)
    .eq("slug", input.slug)
    .limit(2);

  return ((data as Array<{ id: string }> | null) ?? []).every((row) => row.id === input.ignoreId);
}

async function ensureNoFileSlugCollision(input: {
  deps: AdminHelpTutorialPatchRouteDeps;
  audience: HelpTutorialAudience;
  slug: string;
  current: HelpTutorialRecord;
}) {
  if (input.current.audience === input.audience && input.current.slug === input.slug) {
    return true;
  }
  const fileDoc = await input.deps.getFileHelpDocByRoleAndSlug(input.audience, input.slug);
  return !fileDoc;
}

export async function patchAdminHelpTutorialResponse(
  request: NextRequest,
  { params }: RouteContext,
  deps: AdminHelpTutorialPatchRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  const { id } = await params;
  const routeLabel = `/api/admin/help/tutorials/${id}`;

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const { data: existing, error: existingError } = await auth.supabase
    .from("help_tutorials")
    .select(
      "id,title,slug,summary,seo_title,meta_description,audience,visibility,status,video_url,body,created_by,updated_by,created_at,updated_at,published_at,unpublished_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) {
    return NextResponse.json({ error: "Tutorial not found" }, { status: 404 });
  }

  const payload = parsed.data;
  const normalizedSlug = normalizeTutorialSlug(payload.slug);
  if (!normalizedSlug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 422 });
  }

  if (!isValidTutorialVisibilityForAudience(payload.audience, payload.visibility)) {
    return NextResponse.json(
      { error: payload.audience === "admin" ? "Admin / Ops tutorials must stay internal." : "Public role tutorials must stay public." },
      { status: 422 }
    );
  }

  if (payload.video_url?.trim() && !extractYouTubeId(payload.video_url)) {
    return NextResponse.json({ error: "Enter a valid YouTube URL." }, { status: 422 });
  }

  const fileSlugAvailable = await ensureNoFileSlugCollision({
    deps,
    audience: payload.audience,
    slug: normalizedSlug,
    current: existing as HelpTutorialRecord,
  });
  if (!fileSlugAvailable) {
    return NextResponse.json({ error: "Slug already exists in shipped help content." }, { status: 409 });
  }

  const tutorialSlugAvailable = await ensureNoTutorialSlugCollision({
    supabase: auth.supabase,
    audience: payload.audience,
    slug: normalizedSlug,
    ignoreId: id,
  });
  if (!tutorialSlugAvailable) {
    return NextResponse.json({ error: "Slug already exists for this audience." }, { status: 409 });
  }

  const mutation = buildTutorialMutation({ ...payload, slug: normalizedSlug }, auth.user.id, existing as HelpTutorialRecord);
  const { data, error } = await auth.supabase
    .from("help_tutorials")
    .update(mutation)
    .eq("id", id)
    .select(
      "id,title,slug,summary,seo_title,meta_description,audience,visibility,status,video_url,body,created_by,updated_by,created_at,updated_at,published_at,unpublished_at"
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to update tutorial" }, { status: 400 });
  }

  return NextResponse.json({ tutorial: data });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return patchAdminHelpTutorialResponse(request, context);
}
