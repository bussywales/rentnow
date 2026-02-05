const STORAGE_PREFIX = "ph:auth:resend:";

function resolveKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function getCooldownRemaining(key: string): number {
  if (typeof window === "undefined") return 0;
  const storageKey = resolveKey(key);
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return 0;
  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt)) {
    window.localStorage.removeItem(storageKey);
    return 0;
  }
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    window.localStorage.removeItem(storageKey);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

export function startCooldown(key: string, seconds: number) {
  if (typeof window === "undefined") return;
  const storageKey = resolveKey(key);
  const expiresAt = Date.now() + seconds * 1000;
  window.localStorage.setItem(storageKey, String(expiresAt));
}
