export type HostListingTilePattern = "portrait" | "square" | "landscape";

export function getHostListingTilePattern(index: number): HostListingTilePattern {
  if (!Number.isFinite(index) || index < 0) {
    return "portrait";
  }

  const position = Math.floor(index) + 1;
  if (position % 7 === 0) {
    return "landscape";
  }
  if (position % 5 === 0) {
    return "square";
  }
  return "portrait";
}

export function getHostListingTileAspectClass(pattern: HostListingTilePattern): string {
  if (pattern === "landscape") {
    return "aspect-[16/9]";
  }
  if (pattern === "square") {
    return "aspect-square";
  }
  return "aspect-[4/5]";
}
