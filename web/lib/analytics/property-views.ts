type PropertyViewGuardInput = {
  viewerId?: string | null;
  ownerId?: string | null;
  lastViewedAt?: string | null;
  now?: Date;
  dedupeSeconds?: number;
};

export function shouldRecordPropertyView({
  viewerId,
  ownerId,
  lastViewedAt,
  now = new Date(),
  dedupeSeconds = 60,
}: PropertyViewGuardInput): boolean {
  if (!viewerId) return true;
  if (ownerId && viewerId === ownerId) return false;
  if (!lastViewedAt) return true;
  const lastViewedMs = new Date(lastViewedAt).getTime();
  const windowMs = dedupeSeconds * 1000;
  return now.getTime() - lastViewedMs > windowMs;
}

export function getDedupeWindowStart(now: Date, dedupeSeconds = 60) {
  return new Date(now.getTime() - dedupeSeconds * 1000).toISOString();
}
