"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  MonetisationOpportunities,
  MonetisationOpportunity,
  MonetisationAction,
} from "@/lib/admin/monetisation-opportunities.server";

const DAY_MS = 24 * 60 * 60 * 1000;

type ActionState = "idle" | "pending" | "done" | "error";

type Props = {
  opportunities: MonetisationOpportunities;
};

function buildFutureIso(days: number) {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

function actionKey(opportunity: MonetisationOpportunity, action: MonetisationAction) {
  return `${opportunity.id}-${action.label}`;
}

function formatMetric(value: number) {
  return value.toLocaleString();
}

function bucketLabel(bucket: MonetisationOpportunity["bucket"]) {
  switch (bucket) {
    case "boost":
      return "Boost candidates";
    case "recovery":
      return "Supply recovery";
    case "upsell":
      return "Upsell targets";
    default:
      return "Opportunities";
  }
}

export default function AdminInsightsMonetisation({ opportunities }: Props) {
  const [statusMap, setStatusMap] = useState<Record<string, ActionState>>({});
  const [error, setError] = useState<string | null>(null);

  const updateStatus = (key: string, status: ActionState) => {
    setStatusMap((prev) => ({ ...prev, [key]: status }));
  };

  const handleAction = async (opportunity: MonetisationOpportunity, action: MonetisationAction) => {
    if (!action.action || !opportunity.listing_id) return;
    const key = actionKey(opportunity, action);
    setError(null);
    updateStatus(key, "pending");

    try {
      if (action.action === "FEATURE" || action.action === "EXTEND") {
        const body: Record<string, unknown> = {
          is_featured: true,
          featured_until: buildFutureIso(action.days ?? 14),
        };
        const res = await fetch(`/api/admin/properties/${opportunity.listing_id}/featured`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("request_failed");
      }

      if (action.action === "REACTIVATE") {
        const res = await fetch(`/api/listings/${opportunity.listing_id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "live" }),
        });
        if (!res.ok) throw new Error("request_failed");
      }

      updateStatus(key, "done");
    } catch (err) {
      updateStatus(key, "error");
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  };

  const hasAny =
    opportunities.buckets.boost.length +
      opportunities.buckets.recovery.length +
      opportunities.buckets.upsell.length >
    0;

  return (
    <section className="space-y-4" data-testid="insights-monetisation-opportunities">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Monetisation opportunities</h2>
        <p className="text-sm text-slate-600">
          Revenue-focused recommendations derived from demand signals and featured usage.
        </p>
      </div>

      {!hasAny ? (
        <div
          className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm"
          data-testid="insights-monetisation-empty"
        >
          No monetisation opportunities detected in this range.
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(opportunities.buckets) as MonetisationOpportunity["bucket"][]).map(
            (bucket) => {
              const items = opportunities.buckets[bucket];
              if (!items.length) return null;
              return (
                <div key={bucket} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{bucketLabel(bucket)}</h3>
                    <span className="text-xs text-slate-500">{items.length} listings</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        data-testid="insights-monetisation-card"
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.title || "Untitled listing"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.city || "Unknown city"}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {bucketLabel(bucket)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                          <span>Views {formatMetric(item.metrics.views)}</span>
                          <span>Saves {formatMetric(item.metrics.saves)}</span>
                          <span>Leads {formatMetric(item.metrics.enquiries)}</span>
                          <span>{item.metrics.rangeDays}d</span>
                        </div>
                        <p className="mt-3 text-xs text-slate-600">{item.reason}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {item.actions.map((action) => {
                            const key = actionKey(item, action);
                            const status = statusMap[key] ?? "idle";
                            const disabled = status === "pending";

                            if (action.href) {
                              return (
                                <Link
                                  key={key}
                                  href={action.href}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                                >
                                  {action.label}
                                </Link>
                              );
                            }

                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => handleAction(item, action)}
                                disabled={disabled}
                                className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition ${
                                  status === "done"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-900 text-white hover:bg-slate-800"
                                } ${disabled ? "opacity-70" : ""}`}
                              >
                                {status === "pending"
                                  ? "Working..."
                                  : status === "done"
                                    ? "Done"
                                    : action.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          )}
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
