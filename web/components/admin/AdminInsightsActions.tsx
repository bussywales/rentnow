"use client";

import { useState } from "react";
import Link from "next/link";
import type { InsightsAction, InsightsActionCta } from "@/lib/admin/insights-actions.server";

const DAY_MS = 24 * 60 * 60 * 1000;

function buildFutureIso(days: number) {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

type ActionState = "idle" | "pending" | "done" | "error";

type Props = {
  actions: InsightsAction[];
};

function getActionKey(action: InsightsAction, cta: InsightsActionCta) {
  return `${action.id}-${cta.label}`;
}

export default function AdminInsightsActions({ actions }: Props) {
  const [statusMap, setStatusMap] = useState<Record<string, ActionState>>({});

  const updateStatus = (key: string, status: ActionState) => {
    setStatusMap((prev) => ({ ...prev, [key]: status }));
  };

  const handleAction = async (action: InsightsAction, cta: InsightsActionCta) => {
    if (!cta.action || !action.property_id) return;
    const key = getActionKey(action, cta);
    updateStatus(key, "pending");

    try {
      if (cta.action === "FEATURE" || cta.action === "EXTEND") {
        const body: Record<string, unknown> = {
          is_featured: true,
          featured_until: buildFutureIso(14),
        };
        if (action.featured_rank !== undefined) {
          body.featured_rank = action.featured_rank;
        }
        const res = await fetch(`/api/admin/properties/${action.property_id}/featured`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("request_failed");
      }

      if (cta.action === "REACTIVATE") {
        const res = await fetch(`/api/listings/${action.property_id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "live" }),
        });
        if (!res.ok) throw new Error("request_failed");
      }

      updateStatus(key, "done");
    } catch {
      updateStatus(key, "error");
    }
  };

  return (
    <section className="space-y-4" data-testid="insights-actions">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Actions & opportunities</h2>
        <p className="text-sm text-slate-600">
          Action cards derived from the selected range. Use these to drive supply growth.
        </p>
      </div>
      {actions.length === 0 ? (
        <div
          className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm"
          data-testid="insights-actions-empty"
        >
          No immediate actions — all looks healthy.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {actions.map((action) => (
            <div
              key={action.id}
              data-testid="insights-action-card"
              className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{action.title}</p>
                  <p className="mt-2 text-xs text-slate-600">{action.description}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {action.type.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {action.cta.map((cta) => {
                  const key = getActionKey(action, cta);
                  const status = statusMap[key] ?? "idle";
                  const disabled = status === "pending";

                  if (cta.href) {
                    return (
                      <Link
                        key={key}
                        href={cta.href}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                      >
                        {cta.label}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      data-testid={`insights-action-${cta.action?.toLowerCase() ?? "action"}`}
                      onClick={() => handleAction(action, cta)}
                      disabled={disabled}
                      className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition ${
                        status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      } ${disabled ? "opacity-70" : ""}`}
                    >
                      {status === "pending" ? "Working..." : status === "done" ? "Done" : cta.label}
                    </button>
                  );
                })}
                {Object.entries(statusMap).some(
                  ([key, status]) => key.startsWith(action.id) && status === "error"
                ) && (
                  <span className="text-xs text-rose-600">Action failed. Try again.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
