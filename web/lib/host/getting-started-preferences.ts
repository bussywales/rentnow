import type { ChecklistItem } from "@/lib/checklists/role-checklists";

const SHOW_COMPLETED_KEY_PREFIX = "home:host:getting-started:show-complete:v1";

export function buildHostGettingStartedShowStorageKey(userId?: string | null) {
  return `${SHOW_COMPLETED_KEY_PREFIX}:${userId ?? "anon"}`;
}

export function isHostGettingStartedComplete(items: ChecklistItem[]) {
  if (!items.length) return false;
  return items.every((item) => item.status === "done" || item.status === "coming_soon");
}

export function parseShowCompletedPreference(value: string | null | undefined) {
  return value === "1";
}

export function resolveHostGettingStartedHidden(input: {
  items: ChecklistItem[];
  showCompleted: boolean;
}) {
  return isHostGettingStartedComplete(input.items) && !input.showCompleted;
}
