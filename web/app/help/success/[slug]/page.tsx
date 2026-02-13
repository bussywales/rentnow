import { notFound } from "next/navigation";
import { SharedHelpDetail } from "@/components/help/SharedHelpPage";
import { getSharedHelpDocBySlug } from "@/lib/help/docs";

export const dynamic = "force-dynamic";

export default async function SuccessHelpDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getSharedHelpDocBySlug("success", slug);
  if (!doc) {
    notFound();
  }
  return <SharedHelpDetail section="success" slug={slug} />;
}
