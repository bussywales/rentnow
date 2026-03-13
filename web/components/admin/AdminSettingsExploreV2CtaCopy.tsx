"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import type { ExploreV2CtaCopyVariant } from "@/lib/explore/explore-presentation";

type Props = {
  variant: ExploreV2CtaCopyVariant;
  updatedAt: string | null;
};

const OPTIONS: Array<{
  value: ExploreV2CtaCopyVariant;
  label: string;
  helper: string;
}> = [
  {
    value: "default",
    label: "Default",
    helper: "Keep the current intent-aware CTA labels.",
  },
  {
    value: "clarity",
    label: "Clarity",
    helper: "Use a softer shortlet CTA: Check availability.",
  },
  {
    value: "action",
    label: "Action",
    helper: "Use a stronger shortlet CTA like Start booking or Book instantly when truthful.",
  },
];

export default function AdminSettingsExploreV2CtaCopy({ variant, updatedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ExploreV2CtaCopyVariant>(variant);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    setError(null);
    setToast(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/app-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: APP_SETTING_KEYS.exploreV2CtaCopyVariant,
            value: { value: draft },
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Unable to update Explore V2 CTA copy variant.");
        }
        setToast("Explore V2 CTA copy variant saved.");
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Unable to update Explore V2 CTA copy variant."
        );
      }
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Explore V2 CTA copy experiment</h2>
        <p className="text-sm text-slate-600">
          Controls the micro-sheet primary CTA wording without changing the underlying action.
        </p>
        <p className="text-xs text-slate-500">
          {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : "Default is Default."}
        </p>
      </div>

      <label className="mt-4 block space-y-1 text-sm text-slate-700">
        <span className="font-medium">Variant</span>
        <select
          className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={draft}
          onChange={(event) => setDraft(event.target.value as ExploreV2CtaCopyVariant)}
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-2 text-xs text-slate-500">
        {OPTIONS.find((option) => option.value === draft)?.helper}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save CTA copy variant"}
        </Button>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {toast ? <p className="text-xs text-emerald-600">{toast}</p> : null}
      </div>
    </section>
  );
}
