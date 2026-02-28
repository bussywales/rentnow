"use client";

import { useMemo, useState } from "react";

type ExploreAnalyticsExportsProps = {
  initialStartDate: string;
  initialEndDate: string;
};

function buildExportHref(input: { date?: string | null; start?: string | null; end?: string | null }) {
  const params = new URLSearchParams();
  if (input.date) params.set("date", input.date);
  if (input.start) params.set("start", input.start);
  if (input.end) params.set("end", input.end);
  return `/api/admin/analytics/explore/export?${params.toString()}`;
}

export function ExploreAnalyticsExports({
  initialStartDate,
  initialEndDate,
}: ExploreAnalyticsExportsProps) {
  const [day, setDay] = useState(initialEndDate);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const dayHref = useMemo(() => buildExportHref({ date: day }), [day]);
  const rangeHref = useMemo(
    () => buildExportHref({ start: startDate, end: endDate }),
    [startDate, endDate]
  );
  const sevenDayHref = useMemo(
    () => buildExportHref({ start: initialStartDate, end: initialEndDate }),
    [initialEndDate, initialStartDate]
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-explore-analytics-exports">
      <h2 className="text-sm font-semibold text-slate-900">CSV exports</h2>
      <p className="mt-1 text-xs text-slate-500">
        Download a single day or a custom date range (including last 7 days).
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="admin-explore-day">
            Day
          </label>
          <input
            id="admin-explore-day"
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          />
          <a
            href={dayHref}
            className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
            data-testid="admin-explore-export-day"
          >
            Export selected day
          </a>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Range</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              aria-label="Range start date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              aria-label="Range end date"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={rangeHref}
              className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
              data-testid="admin-explore-export-range"
            >
              Export selected range
            </a>
            <a
              href={sevenDayHref}
              className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
              data-testid="admin-explore-export-last7"
            >
              Export last 7 days
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
