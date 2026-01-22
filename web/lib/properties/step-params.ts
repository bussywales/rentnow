export const STEP_IDS = ["basics", "details", "photos", "preview", "submit"] as const;
export type StepId = (typeof STEP_IDS)[number];

export function normalizeStepParam(value: string | null | undefined): StepId {
  switch ((value || "").toLowerCase()) {
    case "details":
      return "details";
    case "photos":
      return "photos";
    case "preview":
      return "preview";
    case "submit":
      return "submit";
    case "basics":
    default:
      return "basics";
  }
}

export function normalizeFocusParam(value: string | null | undefined): "location" | "photos" | null {
  const normalized = (value || "").toLowerCase();
  if (normalized === "location") return "location";
  if (normalized === "photos") return "photos";
  return null;
}
