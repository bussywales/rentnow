export type DashboardPropertiesSearchParams = Record<string, string | string[] | undefined>;

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function buildHostListingsRedirectHref(
  params: DashboardPropertiesSearchParams = {}
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (!hasValue(entry)) continue;
        query.append(key, entry);
      }
      continue;
    }

    if (!hasValue(value)) continue;
    query.set(key, value);
  }

  if (!query.get("view")) {
    query.set("view", "manage");
  }

  const queryString = query.toString();
  return queryString ? `/host/listings?${queryString}` : "/host/listings?view=manage";
}
