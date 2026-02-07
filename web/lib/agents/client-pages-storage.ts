export const CLIENT_PAGES_BUCKET = resolveClientPagesBucket();

export const MAX_CLIENT_PAGE_IMAGE_BYTES = 5 * 1024 * 1024;
export const CLIENT_PAGE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function resolveClientPagesBucket() {
  if (typeof process !== "undefined") {
    const server = (process.env as Record<string, string | undefined>).SUPABASE_CLIENT_PAGES_BUCKET;
    if (server) return server;
  }
  const client =
    (typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)
          .NEXT_PUBLIC_SUPABASE_CLIENT_PAGES_BUCKET
      : undefined) || "agent-client-pages";
  return client;
}

export function isAllowedClientPageImageType(type: string | null | undefined): boolean {
  if (!type) return false;
  return (CLIENT_PAGE_IMAGE_TYPES as readonly string[]).includes(type.toLowerCase());
}

export function isAllowedClientPageImageSize(size: number): boolean {
  return Number.isFinite(size) && size > 0 && size <= MAX_CLIENT_PAGE_IMAGE_BYTES;
}

export function extensionForClientPageImage(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return "jpg";
}

export function buildClientPageImagePath(
  agentId: string,
  clientPageId: string,
  type: "banner" | "logo",
  filename: string
) {
  return `client-pages/${agentId}/${clientPageId}/${type}/${filename}`;
}
