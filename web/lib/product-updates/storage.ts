export const PRODUCT_UPDATES_BUCKET = resolveProductUpdatesBucket();

export const MAX_PRODUCT_UPDATE_IMAGE_BYTES = 5 * 1024 * 1024;
export const PRODUCT_UPDATE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function resolveProductUpdatesBucket() {
  if (typeof process !== "undefined") {
    const server = (process.env as Record<string, string | undefined>).SUPABASE_PRODUCT_UPDATES_BUCKET;
    if (server) return server;
  }
  const client =
    (typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)
          .NEXT_PUBLIC_SUPABASE_PRODUCT_UPDATES_BUCKET
      : undefined) || "product-updates";
  return client;
}

export function isAllowedProductUpdateImageType(type: string | null | undefined): boolean {
  if (!type) return false;
  return (PRODUCT_UPDATE_IMAGE_TYPES as readonly string[]).includes(type.toLowerCase());
}

export function isAllowedProductUpdateImageSize(size: number): boolean {
  return Number.isFinite(size) && size > 0 && size <= MAX_PRODUCT_UPDATE_IMAGE_BYTES;
}

export function extensionForProductUpdateImage(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return "jpg";
}

export function buildProductUpdateImagePath(id: string) {
  return `updates/${id}`;
}
