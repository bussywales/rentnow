import type { HelpRole } from "@/lib/help/docs";

export const HELP_TUTORIAL_AUDIENCES = ["tenant", "landlord", "agent", "admin"] as const;
export type HelpTutorialAudience = (typeof HELP_TUTORIAL_AUDIENCES)[number];

export const HELP_TUTORIAL_VISIBILITIES = ["public", "internal"] as const;
export type HelpTutorialVisibility = (typeof HELP_TUTORIAL_VISIBILITIES)[number];

export const HELP_TUTORIAL_STATUSES = ["draft", "published"] as const;
export type HelpTutorialStatus = (typeof HELP_TUTORIAL_STATUSES)[number];

export const HELP_TUTORIAL_AUDIENCE_LABELS: Record<HelpTutorialAudience, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  agent: "Agent",
  admin: "Admin / Ops",
};

export const HELP_TUTORIAL_VISIBILITY_LABELS: Record<HelpTutorialVisibility, string> = {
  public: "Public",
  internal: "Internal",
};

export const HELP_TUTORIAL_STATUS_LABELS: Record<HelpTutorialStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export type HelpTutorialRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  seo_title: string | null;
  meta_description: string | null;
  audience: HelpTutorialAudience;
  visibility: HelpTutorialVisibility;
  status: HelpTutorialStatus;
  video_url: string | null;
  body: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  unpublished_at: string | null;
};

export function isHelpTutorialAudience(value: string | null | undefined): value is HelpTutorialAudience {
  return !!value && HELP_TUTORIAL_AUDIENCES.includes(value as HelpTutorialAudience);
}

export function isHelpTutorialVisibility(
  value: string | null | undefined
): value is HelpTutorialVisibility {
  return !!value && HELP_TUTORIAL_VISIBILITIES.includes(value as HelpTutorialVisibility);
}

export function isHelpTutorialStatus(value: string | null | undefined): value is HelpTutorialStatus {
  return !!value && HELP_TUTORIAL_STATUSES.includes(value as HelpTutorialStatus);
}

export function getAllowedTutorialVisibilities(
  audience: HelpTutorialAudience
): HelpTutorialVisibility[] {
  return audience === "admin" ? ["internal"] : ["public"];
}

export function coerceTutorialVisibility(
  audience: HelpTutorialAudience,
  visibility?: HelpTutorialVisibility | null
): HelpTutorialVisibility {
  const allowed = getAllowedTutorialVisibilities(audience);
  return visibility && allowed.includes(visibility) ? visibility : allowed[0];
}

export function isValidTutorialVisibilityForAudience(
  audience: HelpTutorialAudience,
  visibility: HelpTutorialVisibility
) {
  return getAllowedTutorialVisibilities(audience).includes(visibility);
}

export function normalizeTutorialSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function tutorialAudienceToHelpRole(audience: HelpTutorialAudience): HelpRole {
  return audience;
}

export function getHelpTutorialPath(audience: HelpTutorialAudience, slug: string): string {
  return `/help/${tutorialAudienceToHelpRole(audience)}/${slug}`;
}

export function extractYouTubeId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v") ?? "";
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }

      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") {
        const id = parts[1] ?? "";
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeTutorialVideoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function composeHelpTutorialBody(input: {
  body: string;
  videoUrl?: string | null;
  videoTitle?: string;
}) {
  const body = input.body.trim();
  const videoId = extractYouTubeId(input.videoUrl ?? null);
  if (!videoId) return body;

  const title = (input.videoTitle || "Tutorial walkthrough").replace(/"/g, "&quot;");
  const embed = `<YouTube id="${videoId}" title="${title}" />`;
  return body ? `${embed}\n\n${body}` : embed;
}

export function resolveTutorialSeoTitle(input: {
  title: string;
  seoTitle?: string | null;
}) {
  const explicit = input.seoTitle?.trim();
  return explicit || input.title.trim();
}

export function resolveTutorialMetaDescription(input: {
  summary: string;
  metaDescription?: string | null;
}) {
  const explicit = input.metaDescription?.trim();
  return explicit || input.summary.trim();
}
