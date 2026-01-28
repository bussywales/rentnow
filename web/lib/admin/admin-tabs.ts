export type AdminTabKey = "overview" | "review" | "listings";

const DEFAULT_TAB: AdminTabKey = "overview";

export function normalizeTabParam(
  tabParam: string | string[] | undefined
): AdminTabKey {
  const value = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  if (value === "overview" || value === "review" || value === "listings") {
    return value;
  }
  return DEFAULT_TAB;
}

export function buildTabHref(
  searchParams: Record<string, string | string[] | undefined>,
  tabKey: AdminTabKey
): string {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "tab") return;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value) {
      params.set(key, value);
    }
  });

  // Keep URL clean: omit tab param when it's the default tab.
  if (tabKey !== DEFAULT_TAB) {
    params.set("tab", tabKey);
  }

  const qs = params.toString();
  return qs ? `/admin?${qs}` : "/admin";
}

export const ADMIN_DEFAULT_TAB = DEFAULT_TAB;

const ALLOWED_PARAM_KEYS = new Set([
  "tab",
  "view",
  "id",
  "status",
  "priceMin",
  "priceMax",
  "propertyType",
  "bedsMin",
  "bathsMin",
  "q",
  "qMode",
  "active",
  "page",
  "pageSize",
  "sort",
]);

export function sanitizeAdminSearchParams(
  params: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  const cleaned: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAM_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      const last = value[value.length - 1];
      if (last) cleaned[key] = last;
    } else if (value) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
