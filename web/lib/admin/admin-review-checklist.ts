import type { AdminReviewListItem } from "@/lib/admin/admin-review";

export type ChecklistSectionKey = "media" | "location" | "pricing" | "content" | "policy";
export type ChecklistStatus = "pass" | "needs_fix" | "blocker";

export type ReviewChecklist = {
  sections: Record<ChecklistSectionKey, ChecklistStatus | null>;
  internalNotes: string;
  warnings: string[];
};

const DEFAULT_SECTIONS: Record<ChecklistSectionKey, ChecklistStatus | null> = {
  media: null,
  location: null,
  pricing: null,
  content: null,
  policy: null,
};

export const CHECKLIST_SECTION_LABELS: Record<ChecklistSectionKey, string> = {
  media: "MEDIA",
  location: "LOCATION",
  pricing: "PRICING",
  content: "CONTENT",
  policy: "POLICY/SAFETY",
};

export function deriveChecklistDefaults(listing: AdminReviewListItem | null): ReviewChecklist {
  if (!listing) {
    return { sections: { ...DEFAULT_SECTIONS }, internalNotes: "", warnings: [] };
  }

  const warnings: string[] = [];
  const sections = { ...DEFAULT_SECTIONS };

  const hasCover = listing.hasCover ?? false;
  if (!hasCover || listing.photoCount === 0) {
    sections.media = "needs_fix";
    warnings.push("Media: missing cover or photos.");
  }

  const missingLocation =
    !listing.city && !listing.state_region && !listing.country_code && listing.locationQuality !== "strong";
  if (missingLocation) {
    sections.location = "needs_fix";
    warnings.push("Location: missing pin or label.");
  }

  const priceMissing =
    listing.price === null ||
    listing.price === undefined ||
    listing.price <= 0 ||
    !listing.currency;
  if (priceMissing) {
    sections.pricing = "needs_fix";
    warnings.push("Pricing: missing price or currency.");
  }

  if (!listing.title || listing.title.trim().length < 10) {
    sections.content = "needs_fix";
    warnings.push("Content: title is too short.");
  }

  return { sections, internalNotes: "", warnings };
}

export function canApproveChecklist(checklist: ReviewChecklist | null): {
  ok: boolean;
  reason: string | null;
} {
  if (!checklist) {
    return { ok: false, reason: "Checklist not started yet." };
  }
  const values = Object.values(checklist.sections);
  if (values.some((value) => value === "blocker")) {
    return { ok: false, reason: "Blockers must be resolved before approving." };
  }
  if (values.some((value) => value !== "pass")) {
    return { ok: false, reason: "All checklist sections must be marked Pass." };
  }
  return { ok: true, reason: null };
}

export function getChecklistSummary(checklist: ReviewChecklist | null) {
  return (Object.keys(DEFAULT_SECTIONS) as ChecklistSectionKey[]).map((key) => ({
    key,
    label: CHECKLIST_SECTION_LABELS[key],
    status: checklist?.sections?.[key] ?? null,
  }));
}

export function getChecklistMissingSections(checklist: ReviewChecklist | null) {
  if (!checklist) return Object.keys(DEFAULT_SECTIONS) as ChecklistSectionKey[];
  return (Object.keys(DEFAULT_SECTIONS) as ChecklistSectionKey[]).filter(
    (key) => checklist.sections[key] !== "pass"
  );
}

export function formatChecklistMissingSections(checklist: ReviewChecklist | null) {
  const missing = getChecklistMissingSections(checklist);
  if (!missing.length) return null;
  const labels = missing.map((key) => CHECKLIST_SECTION_LABELS[key]);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
