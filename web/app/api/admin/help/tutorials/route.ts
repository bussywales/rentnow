import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getFileHelpDocByRoleAndSlug } from "@/lib/help/docs";
import {
  HELP_TUTORIAL_AUDIENCES,
  HELP_TUTORIAL_STATUSES,
  HELP_TUTORIAL_VISIBILITIES,
  extractYouTubeId,
  isValidTutorialVisibilityForAudience,
  normalizeTutorialSlug,
  type HelpTutorialAudience,
  type HelpTutorialRecord,
} from "@/lib/help/tutorials";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const routeLabel = "/api/admin/help/tutorials";

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(10).max(280),
  audience: z.enum(HELP_TUTORIAL_AUDIENCES),
  visibility: z.enum(HELP_TUTORIAL_VISIBILITIES),
  status: z.enum(HELP_TUTORIAL_STATUSES).default("draft"),
  video_url: z.string().trim().max(240).nullable().optional(),
  body: z.string().trim().min(20).max(20000),
});

type CreatePayload = z.infer<typeof createSchema>;

type TutorialSlugCollisionResult = { data: Array<{ id: string }> | null };

type TutorialQueryClient = {
  from: (table: string) => TutorialQueryBuilder;
};

type TutorialQueryBuilder = PromiseLike<TutorialSlugCollisionResult> & {
  select: (columns: string) => TutorialQueryBuilder;
  eq: (column: string, value: string) => TutorialQueryBuilder;
  limit: (count: number) => TutorialQueryBuilder;
};

export type AdminHelpTutorialRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  getFileHelpDocByRoleAndSlug: typeof getFileHelpDocByRoleAndSlug;
};

export const defaultAdminHelpTutorialRouteDeps: AdminHelpTutorialRouteDeps = {
  hasServerSupabaseEnv,
  requireRole,
  getFileHelpDocByRoleAndSlug,
};

async function ensureNoFileSlugCollision(deps: AdminHelpTutorialRouteDeps, input: {
  audience: HelpTutorialAudience;
  slug: string;
}) {
  const fileDoc = await deps.getFileHelpDocByRoleAndSlug(input.audience, input.slug);
  return !fileDoc;
}

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

export function buildTutorialMutation(
  payload: CreatePayload,
  userId: string,
  existing?: HelpTutorialRecord | null
) {
  const normalizedSlug = normalizeTutorialSlug(payload.slug);
  const normalizedVideoUrl = payload.video_url?.trim() ? payload.video_url.trim() : null;
  const status = payload.status;
  const publishedNow = status === "published";
  const wasPublished = existing?.status === "published";
  const now = new Date().toISOString();

  return {
    title: payload.title.trim(),
    slug: normalizedSlug,
    summary: payload.summary.trim(),
    audience: payload.audience,
    visibility: payload.visibility,
    status,
    video_url: normalizedVideoUrl,
    body: payload.body.trim(),
    updated_by: userId,
    published_at: publishedNow ? existing?.published_at ?? now : null,
    unpublished_at: !publishedNow && wasPublished ? now : null,
    ...(existing ? {} : { created_by: userId }),
  };
}

export async function postAdminHelpTutorialsResponse(
  request: NextRequest,
  deps: AdminHelpTutorialRouteDeps = defaultAdminHelpTutorialRouteDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
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

  const fileSlugAvailable = await ensureNoFileSlugCollision(deps, {
    audience: payload.audience,
    slug: normalizedSlug,
  });
  if (!fileSlugAvailable) {
    return NextResponse.json({ error: "Slug already exists in shipped help content." }, { status: 409 });
  }

  const tutorialSlugAvailable = await ensureNoTutorialSlugCollision({
    supabase: auth.supabase,
    audience: payload.audience,
    slug: normalizedSlug,
  });
  if (!tutorialSlugAvailable) {
    return NextResponse.json({ error: "Slug already exists for this audience." }, { status: 409 });
  }

  const mutation = buildTutorialMutation({ ...payload, slug: normalizedSlug }, auth.user.id);
  const { data, error } = await auth.supabase
    .from("help_tutorials")
    .insert(mutation)
    .select(
      "id,title,slug,summary,audience,visibility,status,video_url,body,created_by,updated_by,created_at,updated_at,published_at,unpublished_at"
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to create tutorial" }, { status: 400 });
  }

  return NextResponse.json({ tutorial: data });
}

export async function POST(request: NextRequest) {
  return postAdminHelpTutorialsResponse(request);
}
