function normalizeSearchParams(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("?")) return trimmed;
  const index = trimmed.indexOf("?");
  if (index >= 0) return trimmed.slice(index);
  return `?${trimmed.replace(/^\?+/, "")}`;
}

function isShortletIntent(searchParams: string | null | undefined) {
  const normalized = normalizeSearchParams(searchParams);
  if (!normalized) return false;
  const params = new URLSearchParams(normalized);
  const stay = String(params.get("stay") || "").trim().toLowerCase();
  const category = String(params.get("category") || "").trim().toLowerCase();
  const intent = String(params.get("intent") || "").trim().toLowerCase();
  const listingIntent = String(params.get("listingIntent") || "").trim().toLowerCase();
  return (
    stay === "shortlet" ||
    category === "shortlet" ||
    intent === "shortlet" ||
    listingIntent === "shortlet"
  );
}

export function resolveMobileQuickStartSearchHref(input?: {
  lastSearchParams?: string | null;
  propertiesHref?: string;
  shortletsHref?: string;
}) {
  const propertiesHref =
    String(input?.propertiesHref || "").trim() || "/properties?open=search";
  const shortletsHref =
    String(input?.shortletsHref || "").trim() || "/shortlets?open=search";
  if (isShortletIntent(input?.lastSearchParams)) return shortletsHref;
  return propertiesHref;
}
