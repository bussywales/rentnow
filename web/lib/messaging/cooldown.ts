export function resolveCooldownUntil(
  retryAfterSeconds: number | null | undefined,
  now: number = Date.now()
): number | null {
  if (typeof retryAfterSeconds !== "number" || retryAfterSeconds <= 0) {
    return null;
  }
  return now + retryAfterSeconds * 1000;
}

export function getCooldownRemaining(
  cooldownUntil: number | null,
  now: number = Date.now()
): number {
  if (!cooldownUntil) return 0;
  return Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
}

export function formatCooldownMessage(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "";
  return `You're sending messages too quickly. Try again in ${remainingSeconds}s.`;
}
