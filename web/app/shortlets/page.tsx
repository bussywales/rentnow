import { ShortletsSearchShell } from "@/components/shortlets/search/ShortletsSearchShell";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

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
  let initialViewerRole: "tenant" | "landlord" | "agent" | "admin" | null = null;
  if (hasServerSupabaseEnv()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        initialViewerRole = normalizeRole(await getUserRole(supabase, user.id));
      }
    } catch {
      initialViewerRole = null;
    }
  }

  return (
    <ShortletsSearchShell
      initialSearchParams={resolvedSearchParams}
      initialViewerRole={initialViewerRole}
    />
  );
}
