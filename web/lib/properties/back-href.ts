type SearchParams = Record<string, string | string[] | undefined>;

const SAFE_BACK_PATH = /^\/(?:properties|shortlets|collections|trips)(?:[/?#]|$)/i;

function getSearchParamValue(
  params: SearchParams | undefined,
  key: string
): string | undefined {
  if (!params) return undefined;
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizePathname(pathname: string): string {
  if (!pathname) return pathname;
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

function isSafeBackPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  if (!SAFE_BACK_PATH.test(trimmed)) return false;

  const lowered = trimmed.toLowerCase();
  if (lowered === "/api" || lowered.startsWith("/api/")) return false;
  if (lowered.includes("://")) return false;
  if (lowered.startsWith("/javascript:")) return false;
  return true;
}

export function resolveBackHref(
  params: SearchParams | undefined,
  referer: string | null
): string | null {
  const rawBack = getSearchParamValue(params, "back");
  if (rawBack) {
    const candidates = [rawBack];
    try {
      const decoded = decodeURIComponent(rawBack);
      if (decoded && decoded !== rawBack) {
        candidates.unshift(decoded);
      }
    } catch {
      // Keep raw candidate only when decode fails.
    }

    for (const candidate of candidates) {
      if (isSafeBackPath(candidate)) return candidate.trim();
    }
  }

  if (!referer) return null;
  try {
    const url = new URL(referer);
    const pathname = normalizePathname(url.pathname);
    if (pathname === "/properties" || pathname === "/shortlets") {
      return `${pathname}${url.search}`;
    }
  } catch {
    return null;
  }
  return null;
}

