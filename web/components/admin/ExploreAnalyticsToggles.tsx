"use client";

import { useState, useTransition } from "react";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { Button } from "@/components/ui/Button";

type ExploreAnalyticsTogglesProps = {
  enabled: boolean;
  consentRequired: boolean;
  noticeEnabled: boolean;
  updatedAt: string | null;
};

export function ExploreAnalyticsToggles({
  enabled,
  consentRequired,
  noticeEnabled,
  updatedAt,
}: ExploreAnalyticsTogglesProps) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState({
    enabled,
    consentRequired,
    noticeEnabled,
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      try {
        const payloads = [
          {
            key: APP_SETTING_KEYS.exploreAnalyticsEnabled,
            value: { enabled: state.enabled },
          },
          {
            key: APP_SETTING_KEYS.exploreAnalyticsConsentRequired,
            value: { enabled: state.consentRequired },
          },
          {
            key: APP_SETTING_KEYS.exploreAnalyticsNoticeEnabled,
            value: { enabled: state.noticeEnabled },
          },
        ];

        const responses = await Promise.all(
          payloads.map((payload) =>
            fetch("/api/admin/app-settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          )
        );

        for (const response of responses) {
          if (response.ok) continue;
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Unable to save analytics settings.");
        }

        setFeedback("Explore analytics settings saved.");
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Unable to save analytics settings."
        );
      }
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-explore-analytics-toggles">
      <h2 className="text-sm font-semibold text-slate-900">Collection controls</h2>
      <p className="mt-1 text-xs text-slate-500">
        Kill-switch stops client sends and the ingest API. Consent mode requires tenant acceptance before send.
      </p>
      {updatedAt ? (
        <p className="mt-1 text-xs text-slate-500">Last updated {new Date(updatedAt).toLocaleString()}</p>
      ) : null}

      <div className="mt-3 grid gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(event) => setState((prev) => ({ ...prev, enabled: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            disabled={pending}
          />
          <span>Explore analytics enabled</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={state.consentRequired}
            onChange={(event) =>
              setState((prev) => ({ ...prev, consentRequired: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            disabled={pending}
          />
          <span>Consent required before sending events</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={state.noticeEnabled}
            onChange={(event) =>
              setState((prev) => ({ ...prev, noticeEnabled: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            disabled={pending}
          />
          <span>Show analytics notice in Explore</span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save controls"}
        </Button>
        {feedback ? <p className="text-xs text-emerald-700">{feedback}</p> : null}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
    </section>
  );
}
