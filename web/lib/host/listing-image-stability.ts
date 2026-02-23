export function normalizeListingImageSrc(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveStableListingImageSrc(
  cache: Map<string, string | null>,
  listingId: string,
  nextSrc: string | null | undefined
): string | null {
  const normalizedNext = normalizeListingImageSrc(nextSrc);
  const cached = cache.get(listingId);

  if (cached === undefined) {
    cache.set(listingId, normalizedNext);
    return normalizedNext;
  }

  if (cached === null && normalizedNext) {
    cache.set(listingId, normalizedNext);
    return normalizedNext;
  }

  return cached;
}
