const SAFE_IMAGE_OPTIMIZER_BYPASS_HOSTS = ["images.unsplash.com"];
const SAFE_IMAGE_OPTIMIZER_BYPASS_SUFFIXES = [".supabase.co"];

function parseRemoteUrl(value: string): URL | null {
  if (!value || value.startsWith("/")) return null;
  const normalized = value.startsWith("//") ? `https:${value}` : value;
  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}

export function shouldBypassNextImageOptimizer(imageUrl: string): boolean {
  const parsed = parseRemoteUrl(imageUrl);
  if (!parsed) return false;
  return (
    SAFE_IMAGE_OPTIMIZER_BYPASS_HOSTS.includes(parsed.hostname) ||
    SAFE_IMAGE_OPTIMIZER_BYPASS_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix))
  );
}

export function shouldUpgradeImageUrlToHttps(imageUrl: string): boolean {
  const parsed = parseRemoteUrl(imageUrl);
  if (!parsed) return false;
  if (parsed.protocol !== "http:") return false;
  return shouldBypassNextImageOptimizer(imageUrl);
}
