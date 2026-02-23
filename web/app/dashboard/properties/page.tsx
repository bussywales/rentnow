import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: Promise<SearchParams>;
};

function buildQueryString(params: SearchParams): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (!entry) continue;
        query.append(key, entry);
      }
      continue;
    }

    if (!value) continue;
    query.set(key, value);
  }

  return query.toString();
}

export default async function DashboardPropertiesRedirectPage({ searchParams }: Props) {
  const resolved = searchParams ? await searchParams : {};
  const query = buildQueryString(resolved);
  redirect(query ? `/host/properties?${query}` : "/host/properties");
}
