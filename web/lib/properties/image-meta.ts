export type RawImageMeta = {
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  blurhash?: string | null;
  storage_path?: string | null;
  original_storage_path?: string | null;
  thumb_storage_path?: string | null;
  card_storage_path?: string | null;
  hero_storage_path?: string | null;
};

export type SanitizedImageMeta = {
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  blurhash: string | null;
  storage_path: string | null;
  original_storage_path: string | null;
  thumb_storage_path: string | null;
  card_storage_path: string | null;
  hero_storage_path: string | null;
};

const MAX_DIM = 20000;

export function sanitizeImageMeta(meta?: RawImageMeta | null): SanitizedImageMeta {
  const cleanDim = (value?: number | null) => {
    if (!Number.isFinite(value ?? null)) return null;
    const num = Math.trunc(value as number);
    if (num <= 0) return null;
    return Math.min(num, MAX_DIM);
  };
  const cleanBytes = (value?: number | null) => {
    if (!Number.isFinite(value ?? null)) return null;
    const num = Math.trunc(value as number);
    if (num < 0) return null;
    return num;
  };
  const cleanFormat = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length ? trimmed : null;
  };
  const cleanPath = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return null;
    return trimmed.replace(/^\/+/, "");
  };
  return {
    width: cleanDim(meta?.width ?? null),
    height: cleanDim(meta?.height ?? null),
    bytes: cleanBytes(meta?.bytes ?? null),
    format: cleanFormat(meta?.format ?? null),
    blurhash: meta?.blurhash ?? null,
    storage_path: cleanPath(meta?.storage_path ?? null),
    original_storage_path: cleanPath(meta?.original_storage_path ?? null),
    thumb_storage_path: cleanPath(meta?.thumb_storage_path ?? null),
    card_storage_path: cleanPath(meta?.card_storage_path ?? null),
    hero_storage_path: cleanPath(meta?.hero_storage_path ?? null),
  };
}
