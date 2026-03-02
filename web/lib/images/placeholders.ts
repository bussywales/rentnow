const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const PLACEHOLDER_PALETTE = [
  "#0f172a",
  "#111827",
  "#1e293b",
  "#1f2937",
  "#273449",
  "#334155",
];
const PLACEHOLDER_DEFAULT_COLOR = "#1e293b";

export type PlaceholderSource = "dominant_color" | "blurhash" | "fallback";

export type ResolvedImagePlaceholder = {
  dominantColor: string;
  blurDataURL: string;
  source: PlaceholderSource;
};

const blurhashDataUrlCache = new Map<string, string>();
const dominantColorDataUrlCache = new Map<string, string>();

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function encodeSvg(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/");
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hexColor: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hexColor) ?? PLACEHOLDER_DEFAULT_COLOR;
  const raw = normalized.slice(1);
  const value = Number.parseInt(raw, 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function rgbToCss(input: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${clampChannel(input.r)},${clampChannel(input.g)},${clampChannel(input.b)},${Math.max(
    0,
    Math.min(1, alpha)
  )})`;
}

function shiftRgb(input: { r: number; g: number; b: number }, delta: number): { r: number; g: number; b: number } {
  return {
    r: input.r + delta,
    g: input.g + delta,
    b: input.b + delta,
  };
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(HEX_COLOR_PATTERN);
  if (!match) return null;
  let raw = match[1].toLowerCase();
  if (raw.length === 3) {
    raw = raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  return `#${raw}`;
}

export function pickDominantColorFallback(seed: string | null | undefined): string {
  const normalizedSeed = String(seed ?? "").trim();
  if (!normalizedSeed) return PLACEHOLDER_DEFAULT_COLOR;
  const index = hashSeed(normalizedSeed) % PLACEHOLDER_PALETTE.length;
  return PLACEHOLDER_PALETTE[index] ?? PLACEHOLDER_DEFAULT_COLOR;
}

function createDominantColorDataUrl(color: string): string {
  const normalized = normalizeHexColor(color) ?? PLACEHOLDER_DEFAULT_COLOR;
  const cached = dominantColorDataUrlCache.get(normalized);
  if (cached) return cached;

  const base = hexToRgb(normalized);
  const lighter = shiftRgb(base, 18);
  const darker = shiftRgb(base, -26);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${rgbToCss(
    lighter,
    0.92
  )}'/><stop offset='1' stop-color='${rgbToCss(darker, 0.94)}'/></linearGradient><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.08'/></feComponentTransfer></filter></defs><rect width='40' height='40' fill='url(#g)'/><rect width='40' height='40' filter='url(#n)'/></svg>`;
  const dataUrl = `data:image/svg+xml,${encodeSvg(svg)}`;
  dominantColorDataUrlCache.set(normalized, dataUrl);
  return dataUrl;
}

export function renderBlurhashToDataUrl(blurhash: string | null | undefined): string | null {
  const normalized = String(blurhash ?? "").trim();
  if (!normalized) return null;
  const cached = blurhashDataUrlCache.get(normalized);
  if (cached) return cached;
  const seededColor = pickDominantColorFallback(normalized);
  const dataUrl = createDominantColorDataUrl(seededColor);
  blurhashDataUrlCache.set(normalized, dataUrl);
  return dataUrl;
}

export function resolveImagePlaceholder(input: {
  dominantColor?: string | null;
  blurhash?: string | null;
  imageUrl?: string | null;
}): ResolvedImagePlaceholder {
  const dominantColor = normalizeHexColor(input.dominantColor);
  if (dominantColor) {
    return {
      dominantColor,
      blurDataURL: createDominantColorDataUrl(dominantColor),
      source: "dominant_color",
    };
  }

  const blurDataURL = renderBlurhashToDataUrl(input.blurhash);
  if (blurDataURL) {
    return {
      dominantColor: pickDominantColorFallback(input.blurhash),
      blurDataURL,
      source: "blurhash",
    };
  }

  const fallbackColor = pickDominantColorFallback(input.imageUrl);
  return {
    dominantColor: fallbackColor,
    blurDataURL: createDominantColorDataUrl(fallbackColor),
    source: "fallback",
  };
}
