export type HostListingTilePattern = "tall" | "square" | "wide";

const HOST_LISTINGS_GRID_CYCLE: HostListingTilePattern[] = [
  "tall",
  "square",
  "square",
  "wide",
  "square",
  "tall",
];

export function getHostListingTilePattern(index: number): HostListingTilePattern {
  if (!Number.isFinite(index) || index < 0) {
    return HOST_LISTINGS_GRID_CYCLE[0];
  }
  return HOST_LISTINGS_GRID_CYCLE[Math.floor(index) % HOST_LISTINGS_GRID_CYCLE.length];
}

export function getHostListingTileClass(pattern: HostListingTilePattern): string {
  if (pattern === "tall") {
    return "row-span-36 md:row-span-38";
  }

  if (pattern === "wide") {
    return "row-span-30 md:col-span-2 md:row-span-32 xl:col-span-2";
  }

  return "row-span-30 md:row-span-32";
}
