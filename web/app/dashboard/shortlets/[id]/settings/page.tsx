import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveLegacyDashboardShortletSettingsRedirect } from "@/lib/routing/dashboard-shortlets-legacy";

export const dynamic = "force-dynamic";

type Params = { id?: string };
type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Params | Promise<Params>;
  searchParams?: SearchParams | Promise<SearchParams>;
};

function extractId(raw: Params | Promise<Params>): Promise<string | undefined> {
  const maybePromise = raw as Promise<Params>;
  const isPromise = typeof (maybePromise as { then?: unknown }).then === "function";
  if (isPromise) {
    return maybePromise.then((p) => p?.id);
  }
  return Promise.resolve((raw as Params)?.id);
}

async function extractSearchParams(
  raw: SearchParams | Promise<SearchParams> | undefined
): Promise<SearchParams> {
  if (!raw) return {};
  const maybePromise = raw as Promise<SearchParams>;
  const isPromise = typeof (maybePromise as { then?: unknown }).then === "function";
  if (isPromise) {
    return maybePromise;
  }
  return raw as SearchParams;
}

export default async function LegacyDashboardShortletSettingsRedirectPage({
  params,
  searchParams,
}: Props) {
  const { user, role } = await resolveServerRole();
  if (!user) {
    logAuthRedirect("/dashboard/shortlets/[id]/settings");
  }

  const target = resolveLegacyDashboardShortletSettingsRedirect({
    userPresent: Boolean(user),
    role,
    propertyId: await extractId(params),
    searchParams: await extractSearchParams(searchParams),
  });

  redirect(target);
}
