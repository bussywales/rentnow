"use client";

type GroupSummary = {
  id: string;
  title: string;
};

type Props = {
  groups: GroupSummary[];
  activeGroupId: string | null;
  onNavigate: (id: string) => void;
};

function linkClasses(active: boolean) {
  return active
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
}

export function AdminSettingsSidebar({ groups, activeGroupId, onNavigate }: Props) {
  return (
    <>
      <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Settings sections
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {groups.map((group) => {
              const active = activeGroupId === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onNavigate(group.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${linkClasses(active)}`}
                  data-testid={`admin-settings-sidebar-link-${group.id}`}
                  aria-current={active ? "true" : undefined}
                >
                  {group.title}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="-mx-1 overflow-x-auto px-1 lg:hidden">
        <div className="flex min-w-max gap-2 pb-1">
          {groups.map((group) => {
            const active = activeGroupId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onNavigate(group.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${linkClasses(active)}`}
                data-testid={`admin-settings-sidebar-link-${group.id}`}
                aria-current={active ? "true" : undefined}
              >
                {group.title}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
