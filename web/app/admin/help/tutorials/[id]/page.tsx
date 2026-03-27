import { AdminHelpTutorialEditor } from "@/components/admin/AdminHelpTutorialEditor";
import { getHelpTutorialForAdmin } from "@/lib/help/tutorial-authoring.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteContext = { params: Promise<{ id: string }> };

export default async function AdminHelpTutorialEditPage({ params }: RouteContext) {
  const { id } = await params;
  const { tutorial, error } = await getHelpTutorialForAdmin(id, `/admin/help/tutorials/${id}`);

  if (error || !tutorial) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Help tutorial</h1>
        <p className="text-sm text-rose-600">{error || "Tutorial not found"}</p>
      </div>
    );
  }

  return <AdminHelpTutorialEditor mode="edit" initialTutorial={tutorial} />;
}
