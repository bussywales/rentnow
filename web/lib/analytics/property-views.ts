type PropertyViewGuardInput = {
  viewerId?: string | null;
  ownerId?: string | null;
  lastViewedAt?: string | null;
  now?: Date;
  dedupeSeconds?: number;
};

type HeaderSource = Headers | Record<string, string | null | undefined>;

const inflightViews = new Map<string, number>();

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

export function shouldSkipInflightView({
  key,
  nowMs = Date.now(),
  windowMs = 2000,
  store = inflightViews,
  scheduleCleanup = true,
}: {
  key: string;
  nowMs?: number;
  windowMs?: number;
  store?: Map<string, number>;
  scheduleCleanup?: boolean;
}) {
  const last = store.get(key);
  if (last && nowMs - last < windowMs) return true;
  store.set(key, nowMs);
  if (scheduleCleanup) {
    setTimeout(() => store.delete(key), windowMs);
  }
  return false;
}

const readHeader = (headers: HeaderSource, key: string) => {
  if (headers instanceof Headers) return headers.get(key);
  return headers[key] ?? null;
};

export function isPrefetchRequest(headers: HeaderSource) {
  const purpose = readHeader(headers, "purpose") ?? readHeader(headers, "sec-purpose");
  if (purpose && purpose.toLowerCase().includes("prefetch")) return true;
  const middlewarePrefetch = readHeader(headers, "x-middleware-prefetch");
  if (middlewarePrefetch && middlewarePrefetch !== "0") return true;
  const routerPrefetch = readHeader(headers, "next-router-prefetch");
  if (routerPrefetch && routerPrefetch !== "0") return true;
  return false;
}

export function shortenId(value?: string | null) {
  if (!value) return null;
  return `${value.slice(0, 8)}…`;
}
