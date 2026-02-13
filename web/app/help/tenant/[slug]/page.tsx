import { notFound } from "next/navigation";
import { RoleHelpDetail } from "@/components/help/RoleHelpPage";
import { getHelpDocByRoleAndSlug } from "@/lib/help/docs";

export const dynamic = "force-dynamic";

export default async function TenantHelpDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getHelpDocByRoleAndSlug("tenant", slug);
  if (!doc) {
    notFound();
  }
  return <RoleHelpDetail role="tenant" slug={slug} />;
}
