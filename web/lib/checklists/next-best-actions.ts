import type { ChecklistItem } from "@/lib/checklists/role-checklists";

const PRIORITY_BY_ID: Record<string, number> = {
  "tenant-verification": 1,
  "host-verification": 1,
  "admin-health": 1,
  "host-submit": 2,
  "host-first-listing": 2,
  "tenant-saved-search": 2,
  "tenant-alerts": 2,
  "admin-alerts": 2,
  "admin-approvals": 2,
  "admin-featured": 2,
  "host-enquiries": 3,
  "tenant-contact": 3,
  "host-featured": 3,
  "tenant-collection": 3,
  "admin-updates": 3,
  "host-profile": 4,
  "host-photos": 4,
};

const WHY_BY_ID: Record<string, string> = {
  "tenant-verification": "Verified identity improves trust and speeds support resolution.",
  "host-verification": "Verification improves listing trust and conversion quality.",
  "tenant-saved-search": "Saved searches keep matching homes flowing back to you.",
  "tenant-alerts": "Alerts notify you quickly when new homes match your criteria.",
  "tenant-collection": "Collections keep shortlists organized and easy to share.",
  "tenant-contact": "Early enquiries increase your chance of securing viewings.",
  "host-profile": "A complete profile helps renters trust your listings faster.",
  "host-first-listing": "Your first live listing unlocks discovery and lead flow.",
  "host-photos": "Strong photos increase click-through and viewing requests.",
  "host-submit": "Submitting for approval is required before public visibility.",
  "host-featured": "Featured placement boosts discovery on high-intent surfaces.",
  "host-enquiries": "Fast responses improve close rates and ranking signals.",
  "admin-approvals": "Clearing approvals keeps supply fresh and reduces host friction.",
  "admin-featured": "Timely featured reviews prevent queue bottlenecks.",
  "admin-alerts": "Healthy alerts ensure saved-search retention and re-engagement.",
  "admin-updates": "Publishing updates keeps users aligned with platform changes.",
  "admin-health": "System checks prevent avoidable launch-day incidents.",
};

export type NextBestAction = {
  id: string;
  label: string;
  href: string;
  why: string;
  note?: string | null;
  status: ChecklistItem["status"];
  priority: number;
};

export type NextBestActionsState = {
  progressPercent: number;
  done: number;
  total: number;
  allComplete: boolean;
  actions: NextBestAction[];
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

export function buildNextBestActions(items: ChecklistItem[], limit = 3): NextBestActionsState {
  const total = items.length;
  const done = items.filter((item) => item.status === "done").length;
  const pending = items.filter((item) => item.status !== "done");
  const actions = pending
    .map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      note: item.note ?? null,
      status: item.status,
      priority: PRIORITY_BY_ID[item.id] ?? 99,
      why: WHY_BY_ID[item.id] ?? "Completing this step improves workflow readiness.",
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.label.localeCompare(b.label);
    })
    .slice(0, Math.max(1, limit));

  return {
    progressPercent: clampPercent(total > 0 ? (done / total) * 100 : 0),
    done,
    total,
    allComplete: pending.length === 0,
    actions,
  };
}
