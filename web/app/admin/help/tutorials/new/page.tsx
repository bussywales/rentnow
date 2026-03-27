import { requireAdminHelpAuthoring } from "@/lib/help/tutorial-authoring.server";
import { AdminHelpTutorialEditor } from "@/components/admin/AdminHelpTutorialEditor";

export const dynamic = "force-dynamic";

export default async function AdminHelpTutorialNewPage() {
  await requireAdminHelpAuthoring("/admin/help/tutorials/new");
  return <AdminHelpTutorialEditor mode="create" />;
}
