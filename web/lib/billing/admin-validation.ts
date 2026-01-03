export type UpgradeRequestAction = "approve" | "reject";

type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function isAdminRole(role?: string | null): boolean {
  return role === "admin";
}

export function validateUpgradeRequestAction(input: {
  action: UpgradeRequestAction;
  note?: string | null;
  role?: string | null;
}): ValidationResult {
  if (!isAdminRole(input.role)) {
    return { ok: false, error: "Forbidden" };
  }
  if (input.action === "reject" && !input.note?.trim()) {
    return { ok: false, error: "Rejection reason is required." };
  }
  return { ok: true };
}
