export function validateResubmitStatus(status: string | null | undefined) {
  if (status !== "changes_requested") {
    return { ok: false as const, code: "RESUBMIT_INVALID_STATE", message: "Nothing to resubmit." };
  }
  return { ok: true as const };
}

export function isResubmitAllowed({
  userId,
  ownerId,
  role,
}: {
  userId: string;
  ownerId: string | null | undefined;
  role?: string | null;
}) {
  if (role === "admin") return true;
  return !!ownerId && ownerId === userId;
}
