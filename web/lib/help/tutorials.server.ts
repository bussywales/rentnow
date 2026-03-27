import type { HelpDoc, HelpRole } from "@/lib/help/docs";
import { hasServerSupabaseEnv, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  composeHelpTutorialBody,
  tutorialAudienceToHelpRole,
  type HelpTutorialAudience,
  type HelpTutorialRecord,
} from "@/lib/help/tutorials";

type HelpTutorialSelectRow = HelpTutorialRecord;

export function toHelpDocFromTutorial(row: HelpTutorialSelectRow): HelpDoc {
  return {
    role: tutorialAudienceToHelpRole(row.audience),
    slug: row.slug,
    filename: `${row.slug}.tutorial`,
    title: row.title,
    description: row.summary,
    order: 999,
    updatedAt: (row.updated_at || row.created_at || new Date().toISOString()).slice(0, 10),
    sourcePath: `db:help_tutorials/${row.id}`,
    body: composeHelpTutorialBody({
      body: row.body,
      videoUrl: row.video_url,
      videoTitle: row.title,
    }),
  };
}

export function mergeHelpDocs(fileDocs: HelpDoc[], tutorialDocs: HelpDoc[]): HelpDoc[] {
  const seen = new Set(fileDocs.map((doc) => doc.slug));
  const merged = [...fileDocs];

  for (const tutorial of tutorialDocs) {
    if (seen.has(tutorial.slug)) continue;
    merged.push(tutorial);
  }

  return merged.sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order));
}

export async function getPublishedTutorialDocsForRole(role: HelpRole): Promise<HelpDoc[]> {
  if (!hasServerSupabaseEnv()) return [];

  try {
    const supabase = await createServerSupabaseClient();
    const visibility = role === "admin" ? "internal" : "public";
    const { data, error } = await supabase
      .from("help_tutorials")
      .select(
        "id,title,slug,summary,audience,visibility,status,video_url,body,created_by,updated_by,created_at,updated_at,published_at,unpublished_at"
      )
      .eq("audience", role as HelpTutorialAudience)
      .eq("status", "published")
      .eq("visibility", visibility)
      .order("updated_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return (data as HelpTutorialSelectRow[]).map((row) => toHelpDocFromTutorial(row));
  } catch {
    return [];
  }
}
