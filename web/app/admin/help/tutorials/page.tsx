import Link from "next/link";
import { listHelpTutorialsForAdmin } from "@/lib/help/tutorial-authoring.server";
import {
  HELP_TUTORIAL_AUDIENCE_LABELS,
  HELP_TUTORIAL_STATUS_LABELS,
  HELP_TUTORIAL_VISIBILITY_LABELS,
} from "@/lib/help/tutorials";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default async function AdminHelpTutorialsPage() {
  const { tutorials, error } = await listHelpTutorialsForAdmin();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4" data-testid="admin-help-tutorials-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Help tutorials</h1>
          <p className="text-sm text-slate-600">
            Create and publish internal admin tutorials or public role tutorials without editing markdown files by hand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/help/admin/help-publishing"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Publishing guide
          </Link>
          <Link
            href="/admin/help/tutorials/new"
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
          >
            Create tutorial
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Tutorial</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tutorials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No authored tutorials yet.
                  </td>
                </tr>
              ) : (
                tutorials.map((tutorial) => (
                  <tr key={tutorial.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-slate-900">{tutorial.title}</div>
                      <div className="mt-1 text-xs text-slate-500">/{tutorial.audience}/{tutorial.slug}</div>
                      <div className="mt-1 text-xs text-slate-600">{tutorial.summary}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {HELP_TUTORIAL_AUDIENCE_LABELS[tutorial.audience]}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {HELP_TUTORIAL_VISIBILITY_LABELS[tutorial.visibility]}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {HELP_TUTORIAL_STATUS_LABELS[tutorial.status]}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{formatDate(tutorial.updated_at)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-3 text-xs font-semibold">
                        <Link href={`/admin/help/tutorials/${tutorial.id}`} className="text-sky-700 underline underline-offset-4">
                          Edit
                        </Link>
                        {tutorial.status === "published" ? (
                          <Link
                            href={tutorial.audience === "admin" ? `/help/admin/${tutorial.slug}` : `/help/${tutorial.audience}/${tutorial.slug}`}
                            className="text-slate-700 underline underline-offset-4"
                          >
                            Open
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
