import { redirect } from "next/navigation";
import {
  buildHostListingsRedirectHref,
  type DashboardPropertiesSearchParams,
} from "@/lib/routing/dashboard-properties-index-redirect";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<DashboardPropertiesSearchParams>;
};

export default async function DashboardPropertiesRedirectPage({ searchParams }: Props) {
  const resolved = searchParams ? await searchParams : {};
  redirect(buildHostListingsRedirectHref(resolved));
}
