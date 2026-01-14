import Link from "next/link";

type ActivityItem = {
  id: string;
  title: string;
  description?: string | null;
  timestamp?: string | null;
  href?: string;
};

type ActivityFeedProps = {
  items: ActivityItem[];
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  const hasItems = items.length > 0;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Recent activity</p>
        <span className="text-xs text-slate-500">Last 30 days</span>
      </div>
      <div className="mt-4 space-y-3">
        {!hasItems && (
          <div className="rounded-xl bg-slate-50/80 px-4 py-6 text-center ring-1 ring-dashed ring-slate-200/70">
            <p className="text-sm font-semibold text-slate-900">
              Browse homes and save a search to start seeing activity.
            </p>
            <Link
              href="/properties"
              className="mt-3 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
            >
              Browse homes
            </Link>
          </div>
        )}
        {items.map((item) => {
          const date = formatDate(item.timestamp);
          const content = (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                {date && (
                  <span className="text-xs text-slate-500">{date}</span>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-slate-600">{item.description}</p>
              )}
            </div>
          );

          return (
            <div
              key={item.id}
              className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200/60"
            >
              {item.href ? (
                <Link href={item.href} className="block">
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
