import Link from "next/link";
import { summarizeChecklist, type ChecklistItem } from "@/lib/checklists/role-checklists";

function statusStyles(status: ChecklistItem["status"]) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "coming_soon") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function statusLabel(status: ChecklistItem["status"]) {
  if (status === "done") return "Done";
  if (status === "coming_soon") return "Coming soon";
  return "To do";
}

export function RoleChecklistPanel({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: ChecklistItem[];
}) {
  const summary = summarizeChecklist(items);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="role-checklist-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          {summary.done}/{summary.total} complete
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={item.href} className="text-sm font-semibold text-slate-900 hover:underline">
                {item.label}
              </Link>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyles(item.status)}`}>
                {statusLabel(item.status)}
              </span>
            </div>
            {item.note ? <p className="mt-1 text-xs text-slate-600">{item.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
