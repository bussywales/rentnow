import { ShortletsSearchShell } from "@/components/shortlets/search/ShortletsSearchShell";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

async function resolveSearchParams(input: Props["searchParams"]): Promise<SearchParams> {
  if (!input) return {};
  const maybePromise = input as Promise<SearchParams>;
  if (typeof (maybePromise as { then?: unknown }).then === "function") {
    return maybePromise;
  }
  return input as SearchParams;
}

export const dynamic = "force-dynamic";

export default async function ShortletsPage({ searchParams }: Props) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  return <ShortletsSearchShell initialSearchParams={resolvedSearchParams} />;
}

