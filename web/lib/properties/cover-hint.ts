export type ImageMeta = {
  width?: number | null;
  height?: number | null;
};

export function classifyCoverHint(meta?: ImageMeta | null) {
  const width = meta?.width ?? null;
  const height = meta?.height ?? null;
  if (!width || !height) {
    return { tooSmall: false, portrait: false, unknown: true };
  }
  const portrait = height > width;
  const tooSmall = width < 1600 || height < 900;
  return { tooSmall, portrait, unknown: false };
}
