export type PhotoQualityStatus = "great" | "warn" | "block";

export type PhotoQualityInput = {
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  type?: string | null;
};

export type PhotoQualityResult = {
  status: PhotoQualityStatus;
  label: string;
  detail?: string | null;
  reason?: string | null;
};

export const PHOTO_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_BLOCK_MIN_WIDTH = 900;
export const PHOTO_BLOCK_MIN_HEIGHT = 600;
export const PHOTO_WARN_MIN_WIDTH = 1600;

const formatDimensions = (width?: number | null, height?: number | null) => {
  if (!width || !height) return null;
  return `${Math.round(width)}×${Math.round(height)}`;
};

export function classifyPhotoQuality(input: PhotoQualityInput): PhotoQualityResult {
  const width = typeof input.width === "number" ? input.width : null;
  const height = typeof input.height === "number" ? input.height : null;
  const bytes = typeof input.bytes === "number" ? input.bytes : null;
  const type = input.type ?? null;

  if (type && !PHOTO_ALLOWED_MIME_TYPES.includes(type as (typeof PHOTO_ALLOWED_MIME_TYPES)[number])) {
    return {
      status: "block",
      label: "Not allowed",
      reason: "Unsupported file type. Use JPG, PNG, or WebP.",
      detail: formatDimensions(width, height),
    };
  }

  if (bytes !== null && bytes > PHOTO_MAX_BYTES) {
    return {
      status: "block",
      label: "Not allowed",
      reason: "File exceeds 10MB.",
      detail: formatDimensions(width, height),
    };
  }

  if (width && height && (width < PHOTO_BLOCK_MIN_WIDTH || height < PHOTO_BLOCK_MIN_HEIGHT)) {
    return {
      status: "block",
      label: "Not allowed",
      reason: `Too small (min ${PHOTO_BLOCK_MIN_WIDTH}×${PHOTO_BLOCK_MIN_HEIGHT}).`,
      detail: formatDimensions(width, height),
    };
  }

  if (!width || !height) {
    return {
      status: "warn",
      label: "Low resolution (may look blurry)",
      reason: "Dimensions unavailable.",
      detail: null,
    };
  }

  if (width < PHOTO_WARN_MIN_WIDTH) {
    return {
      status: "warn",
      label: "Low resolution (may look blurry)",
      reason: null,
      detail: formatDimensions(width, height),
    };
  }

  return {
    status: "great",
    label: "Great quality",
    detail: formatDimensions(width, height),
    reason: null,
  };
}

export function isPhotoLowQuality(input: PhotoQualityInput): boolean {
  const result = classifyPhotoQuality(input);
  return result.status === "warn" || result.status === "block";
}
