import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleHelpDetail } from "@/components/help/RoleHelpPage";
import { getHelpDocByRoleAndSlug } from "@/lib/help/docs";
import { getHelpDocMetadata } from "@/lib/help/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return getHelpDocMetadata("landlord", slug);
}

export default async function LandlordHelpDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getHelpDocByRoleAndSlug("landlord", slug);
  if (!doc) {
    notFound();
  }
  return <RoleHelpDetail role="landlord" slug={slug} />;
}
