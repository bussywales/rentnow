export const PROPERTY_IMAGE_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "property-images";

export const IMAGE_OPTIMISATION_ENABLED = (() => {
  const raw = process.env.IMAGE_OPTIMISATION_ENABLED;
  if (typeof raw !== "string") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
})();

export const PROPERTY_IMAGE_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const PROPERTY_IMAGE_BLOCK_MIN_WIDTH = 600;
export const PROPERTY_IMAGE_WARN_MIN_WIDTH = 1200;

export const PROPERTY_IMAGE_DERIVATIVES = {
  thumb: { width: 480, fileName: "thumb.webp" },
  card: { width: 1200, fileName: "card.webp" },
  hero: { width: 2000, fileName: "hero.webp" },
} as const;

const EXTENSION_TO_FORMAT: Record<string, string> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const SUPPORTED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export type PropertyImageDerivativeKey = keyof typeof PROPERTY_IMAGE_DERIVATIVES;

export type PropertyImageStoragePaths = {
  original: string;
  thumb: string;
  card: string;
  hero: string;
};

export function normalizeImageExtension(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase().replace(/^\./, "");
  if (!normalized) return null;
  return SUPPORTED_IMAGE_EXTENSIONS.has(normalized) ? normalized : null;
}

export function extensionFromMimeType(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  return MIME_TO_EXTENSION[normalized] ?? null;
}

export function extensionFromFileName(input: string | null | undefined): string | null {
  if (!input) return null;
  const parts = input.split(".");
  if (parts.length < 2) return null;
  return normalizeImageExtension(parts[parts.length - 1] ?? null);
}

export function formatFromExtension(extension: string | null | undefined): string | null {
  const normalized = normalizeImageExtension(extension);
  if (!normalized) return null;
  return EXTENSION_TO_FORMAT[normalized] ?? normalized;
}

export function buildPropertyImageStoragePaths(input: {
  propertyId: string;
  imageId: string;
  extension: string;
}): PropertyImageStoragePaths {
  const ext = normalizeImageExtension(input.extension) ?? "jpg";
  const base = `properties/${input.propertyId}/${input.imageId}`;
  return {
    original: `${base}/original.${ext}`,
    thumb: `${base}/${PROPERTY_IMAGE_DERIVATIVES.thumb.fileName}`,
    card: `${base}/${PROPERTY_IMAGE_DERIVATIVES.card.fileName}`,
    hero: `${base}/${PROPERTY_IMAGE_DERIVATIVES.hero.fileName}`,
  };
}

export function classifyImageWidth(width: number | null | undefined): {
  reject: boolean;
  warn: boolean;
} {
  if (!width || !Number.isFinite(width)) {
    return { reject: true, warn: false };
  }
  if (width < PROPERTY_IMAGE_BLOCK_MIN_WIDTH) {
    return { reject: true, warn: false };
  }
  if (width < PROPERTY_IMAGE_WARN_MIN_WIDTH) {
    return { reject: false, warn: true };
  }
  return { reject: false, warn: false };
}
