export type ImageLoadingViewport = "desktop" | "mobile";

export type ImageLoadingSurface =
  | "shortlets_list"
  | "properties_list"
  | "property_gallery"
  | "map_preview";

type PriorityInput = {
  surface: ImageLoadingSurface;
  index: number;
  slideIndex?: number;
  viewport?: ImageLoadingViewport;
};

const ABOVE_FOLD_LIMITS: Record<
  Extract<ImageLoadingSurface, "shortlets_list" | "properties_list">,
  Record<ImageLoadingViewport, number>
> = {
  shortlets_list: {
    desktop: 3,
    mobile: 2,
  },
  properties_list: {
    desktop: 3,
    mobile: 2,
  },
};

function normalizeIndex(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function shouldPriorityImage(input: PriorityInput): boolean {
  const slideIndex = normalizeIndex(input.slideIndex ?? 0);
  if (slideIndex > 0) return false;

  const index = normalizeIndex(input.index);
  const viewport = input.viewport ?? "desktop";

  if (input.surface === "property_gallery") return index === 0;
  if (input.surface === "map_preview") return false;

  const limit = ABOVE_FOLD_LIMITS[input.surface][viewport];
  return index < limit;
}

export function resolveFetchPriority(priority: boolean): "high" | "auto" {
  return priority ? "high" : "auto";
}

export function resolveImageLoading(priority: boolean): "eager" | "lazy" {
  return priority ? "eager" : "lazy";
}

export function resolveImageLoadingProfile(priority: boolean): {
  priority: boolean;
  loading: "eager" | "lazy";
  fetchPriority: "high" | "auto";
} {
  return {
    priority,
    loading: resolveImageLoading(priority),
    fetchPriority: resolveFetchPriority(priority),
  };
}
