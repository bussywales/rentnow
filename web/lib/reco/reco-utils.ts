export function normalizeLimit(limit: number | null | undefined, max = 12): number {
  if (!Number.isFinite(limit ?? Number.NaN)) return Math.min(6, max);
  return Math.max(1, Math.min(max, Math.trunc(limit ?? 0)));
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRank(seedBase: string): number {
  const random = mulberry32(hashSeed(seedBase));
  return random();
}
